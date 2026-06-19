import { InferenceSession, Tensor } from 'onnxruntime-node'
import sharp from 'sharp'
import app from '@adonisjs/core/services/app'

/**
 * YoloService — Inferencia de YOLOv8 ejecutada dentro del propio backend AdonisJS
 * usando ONNX Runtime (sin microservicio Python externo).
 *
 * Reemplaza el pipeline de FastAPI (detector + counter) replicando su lógica:
 *  - Detecta únicamente personas (clase COCO 0)
 *  - Cuenta detecciones tras NMS
 *  - Traduce el conteo a un nivel de ocupación
 */

const MODEL_INPUT = 640
const CONF_THRESHOLD = 0.4 // == DETECTION_CONFIDENCE (config.py)
const IOU_THRESHOLD = 0.45
const PERSON_CLASS = 0 // COCO: person
const BUS_MAX_CAPACITY = 60 // == BUS_MAX_CAPACITY (config.py)

// Umbrales de ocupación (fracción de la capacidad) — espejo de OCCUPANCY_THRESHOLDS
const OCCUPANCY_THRESHOLDS: ReadonlyArray<[string, number, number]> = [
  ['EMPTY', 0.0, 0.2],
  ['LOW', 0.2, 0.5],
  ['MEDIUM', 0.5, 0.8],
  ['HIGH', 0.8, 1.0],
  ['FULL', 1.0, Number.POSITIVE_INFINITY],
]

interface Box {
  x1: number
  y1: number
  x2: number
  y2: number
  score: number
}

export interface AnalysisResult {
  bus_id: string | null
  passenger_count: number
  capacity: number
  occupancy_rate: number
  occupancy_level: string
  inference_ms: number
}

class YoloService {
  #session: InferenceSession | null = null
  #inputName = 'images'

  /** Carga (perezosa, una sola vez) la sesión de inferencia ONNX. */
  async #getSession(): Promise<InferenceSession> {
    if (!this.#session) {
      const modelPath = process.env.YOLO_MODEL_PATH ?? app.makePath('..', 'yolov8n.onnx')
      this.#session = await InferenceSession.create(modelPath)
      this.#inputName = this.#session.inputNames[0]
    }
    return this.#session
  }

  /**
   * Analiza una imagen y devuelve el conteo de pasajeros + nivel de ocupación.
   * @param imageBuffer  bytes de la imagen (jpg/png/webp)
   * @param busId        identificador opcional para trazabilidad
   */
  async analyzeImage(imageBuffer: Buffer, busId: string | null = null): Promise<AnalysisResult> {
    const session = await this.#getSession()
    const t0 = performance.now()

    const input = await this.#preprocess(imageBuffer)
    const outputs = await session.run({ [this.#inputName]: input })
    const output = outputs[session.outputNames[0]]
    const count = this.#postprocess(output.data as Float32Array, output.dims)

    const rate = BUS_MAX_CAPACITY > 0 ? count / BUS_MAX_CAPACITY : 0
    const elapsedMs = Math.round((performance.now() - t0) * 10) / 10

    return {
      bus_id: busId,
      passenger_count: count,
      capacity: BUS_MAX_CAPACITY,
      occupancy_rate: Math.round(rate * 1000) / 1000,
      occupancy_level: this.#classify(rate),
      inference_ms: elapsedMs,
    }
  }

  /** Letterbox a 640x640, normaliza a [0,1] y reordena a tensor NCHW (RGB). */
  async #preprocess(imageBuffer: Buffer): Promise<Tensor> {
    const image = sharp(imageBuffer).removeAlpha()
    const meta = await image.metadata()
    const w = meta.width ?? MODEL_INPUT
    const h = meta.height ?? MODEL_INPUT

    const scale = MODEL_INPUT / Math.max(w, h)
    const newW = Math.round(w * scale)
    const newH = Math.round(h * scale)
    const dx = Math.floor((MODEL_INPUT - newW) / 2)
    const dy = Math.floor((MODEL_INPUT - newH) / 2)

    const resized = await image
      .resize(newW, newH, { fit: 'fill' })
      .extend({
        top: dy,
        bottom: MODEL_INPUT - newH - dy,
        left: dx,
        right: MODEL_INPUT - newW - dx,
        background: { r: 114, g: 114, b: 114 },
      })
      .raw()
      .toBuffer()

    const area = MODEL_INPUT * MODEL_INPUT
    const floatData = new Float32Array(area * 3)
    for (let i = 0; i < area; i++) {
      floatData[i] = resized[i * 3] / 255 // R
      floatData[i + area] = resized[i * 3 + 1] / 255 // G
      floatData[i + 2 * area] = resized[i * 3 + 2] / 255 // B
    }

    return new Tensor('float32', floatData, [1, 3, MODEL_INPUT, MODEL_INPUT])
  }

  /**
   * Decodifica la salida YOLOv8 [1, 84, 8400], filtra personas por confianza
   * y aplica NMS. Devuelve el número de personas detectadas.
   * (No se des-hace el letterbox: solo importa el conteo.)
   */
  #postprocess(data: Float32Array, dims: readonly number[]): number {
    // dims = [1, 84, 8400] → 84 = 4 bbox + 80 clases COCO
    const numBoxes = dims[2] // 8400
    const scoreOffset = (4 + PERSON_CLASS) * numBoxes

    const boxes: Box[] = []
    for (let b = 0; b < numBoxes; b++) {
      const score = data[scoreOffset + b]
      if (score < CONF_THRESHOLD) continue

      const cx = data[b]
      const cy = data[numBoxes + b]
      const ww = data[2 * numBoxes + b]
      const hh = data[3 * numBoxes + b]
      boxes.push({
        x1: cx - ww / 2,
        y1: cy - hh / 2,
        x2: cx + ww / 2,
        y2: cy + hh / 2,
        score,
      })
    }

    return this.#nms(boxes, IOU_THRESHOLD).length
  }

  /** Non-Maximum Suppression simple (greedy). */
  #nms(boxes: Box[], iouThreshold: number): Box[] {
    boxes.sort((a, b) => b.score - a.score)
    const kept: Box[] = []
    const removed = new Array<boolean>(boxes.length).fill(false)

    for (let i = 0; i < boxes.length; i++) {
      if (removed[i]) continue
      kept.push(boxes[i])
      for (let j = i + 1; j < boxes.length; j++) {
        if (removed[j]) continue
        if (this.#iou(boxes[i], boxes[j]) > iouThreshold) removed[j] = true
      }
    }
    return kept
  }

  #iou(a: Box, b: Box): number {
    const interX1 = Math.max(a.x1, b.x1)
    const interY1 = Math.max(a.y1, b.y1)
    const interX2 = Math.min(a.x2, b.x2)
    const interY2 = Math.min(a.y2, b.y2)
    const interW = Math.max(0, interX2 - interX1)
    const interH = Math.max(0, interY2 - interY1)
    const interArea = interW * interH
    const areaA = (a.x2 - a.x1) * (a.y2 - a.y1)
    const areaB = (b.x2 - b.x1) * (b.y2 - b.y1)
    const union = areaA + areaB - interArea
    return union > 0 ? interArea / union : 0
  }

  #classify(rate: number): string {
    for (const [level, lo, hi] of OCCUPANCY_THRESHOLDS) {
      if (rate >= lo && rate < hi) return level
    }
    return 'FULL'
  }
}

export default new YoloService()
