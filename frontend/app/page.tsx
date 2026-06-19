"use client"

import { useState, useEffect, useRef } from "react"

const BACKEND_URL = "http://localhost:3333/api/v1"
const DEFAULT_PHONE = "573126078359"

// Haversine distance (km) — mirrors the backend whatsapp_service helper
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371 // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

interface Station {
  id: number
  name: string
  location: string | null
  occupancyLevel: "LOW" | "MEDIUM" | "HIGH"
  passengerCount: number
  updatedAt: string | null
  latitude?: number | null
  longitude?: number | null
}

interface Bus {
  id: number
  plate: string
  routeId: number | null
  occupancyLevel: "LOW" | "MEDIUM" | "HIGH"
  passengerCount: number
  status: "IN_TRANSIT" | "STOPPED" | "OUT_OF_SERVICE"
  route?: { name: string; description: string } | null
  latitude?: number | null
  longitude?: number | null
}

interface RouteStation {
  id: number
  routeId: number
  stationId: number
  sequenceOrder: number
  station: Station
}

interface Route {
  id: number
  name: string
  description: string | null
  schedule: string | null
  routeStations: RouteStation[]
  buses: Bus[]
}

interface ChatMessage {
  sender: "user" | "bot"
  text: string
  timestamp: Date
  isAudio?: boolean
}

interface WhatsappStatus {
  status: "DISCONNECTED" | "INITIALIZING" | "QR_READY" | "CONNECTED" | "ERROR"
  errorMessage: string | null
  qr: string | null
  hasGeminiKey?: boolean
}

export default function Dashboard() {
  // Real-time states
  const [stations, setStations] = useState<Station[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [buses, setBuses] = useState<Bus[]>([])
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsappStatus>({
    status: "DISCONNECTED",
    errorMessage: null,
    qr: null,
    hasGeminiKey: false,
  })

  // Chat simulator states (fixed for +573126078359)
  const [chatNumber, setChatNumber] = useState<string>(DEFAULT_PHONE)
  const [activeChats, setActiveChats] = useState<any[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "bot",
      text: "👋 ¡Hola! Soy el asistente virtual de Metrolínea (SITME). 🤖\nTe ayudo a consultar rutas, ver la ocupación en tiempo real y evitar buses llenos.\n\n¿En qué estación te encuentras actualmente y hacia dónde te diriges?",
      timestamp: new Date(),
    },
  ])
  const [inputText, setInputText] = useState<string>("")
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [chatContext, setChatContext] = useState<any>({ step: "welcome" })

  // UI Selection states for simulating updates
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null)

  // Loading/Sync indicator
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  // Telemetry table states
  const [tableFilterType, setTableFilterType] = useState<"all" | "stations" | "buses">("all")
  const [tableSearchQuery, setTableSearchQuery] = useState<string>("")

  // Coordinates simulation states
  const [userLatitude, setUserLatitude] = useState<number>(7.0945)
  const [userLongitude, setUserLongitude] = useState<number>(-73.1118)
  const [analyzeLatitude, setAnalyzeLatitude] = useState<string>("")
  const [analyzeLongitude, setAnalyzeLongitude] = useState<string>("")

  // AI Analyzer states
  const [activeTab, setActiveTab] = useState<"monitor" | "ai_analyze">("monitor")
  const [analyzeTargetType, setAnalyzeTargetType] = useState<"station" | "bus">("station")
  const [analyzeTargetId, setAnalyzeTargetId] = useState<string>("")
  const [analyzeImageFile, setAnalyzeImageFile] = useState<File | null>(null)
  const [analyzeImagePreview, setAnalyzeImagePreview] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analyzeResult, setAnalyzeResult] = useState<any | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  // ETA inputs within the analyzer (only relevant when the target is a bus)
  const [analyzeSpeed, setAnalyzeSpeed] = useState<string>("25")
  const [analyzeEtaResult, setAnalyzeEtaResult] = useState<number | null>(null)

  // ETA Calculator states (opened from telemetry table for buses)
  const [etaBus, setEtaBus] = useState<Bus | null>(null)
  const [etaSpeed, setEtaSpeed] = useState<string>("25")
  const [etaLat, setEtaLat] = useState<string>("")
  const [etaLon, setEtaLon] = useState<string>("")
  const [etaDestStationId, setEtaDestStationId] = useState<string>("")
  const [etaSaving, setEtaSaving] = useState<boolean>(false)
  const [etaSaveMsg, setEtaSaveMsg] = useState<string | null>(null)

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Pre-populate analysis target coordinates
  useEffect(() => {
    if (!analyzeTargetId) {
      setAnalyzeLatitude("")
      setAnalyzeLongitude("")
      return
    }
    if (analyzeTargetType === "station") {
      const st = stations.find((s) => s.id.toString() === analyzeTargetId)
      if (st) {
        setAnalyzeLatitude(st.latitude ? st.latitude.toString() : "")
        setAnalyzeLongitude(st.longitude ? st.longitude.toString() : "")
      }
    } else {
      const b = buses.find((x) => x.id.toString() === analyzeTargetId)
      if (b) {
        setAnalyzeLatitude(b.latitude ? b.latitude.toString() : "")
        setAnalyzeLongitude(b.longitude ? b.longitude.toString() : "")
      }
    }
  }, [analyzeTargetId, analyzeTargetType, stations, buses])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Fetch initial data & poll
  const fetchData = async () => {
    setIsSyncing(true)
    try {
      const [resStations, resRoutes, resBuses, resWA] = await Promise.all([
        fetch(`${BACKEND_URL}/stations`),
        fetch(`${BACKEND_URL}/routes`),
        fetch(`${BACKEND_URL}/buses`),
        fetch(`${BACKEND_URL}/whatsapp/status`),
      ])

      if (resStations.ok) setStations(await resStations.json())
      if (resRoutes.ok) setRoutes(await resRoutes.json())
      if (resBuses.ok) setBuses(await resBuses.json())
      if (resWA.ok) setWhatsappStatus(await resWA.json())

      setSyncError(null)
    } catch (err) {
      console.error("Error fetching backend data:", err)
      setSyncError("No se pudo conectar con el servidor backend (localhost:3333)")
    } finally {
      setIsSyncing(false)
    }
  }

  // Poll chat history directly from database
  const fetchChat = async (isInitialLoad?: boolean) => {
    try {
      const res = await fetch(`${BACKEND_URL}/whatsapp/chats/${chatNumber}`)
      if (res.ok) {
        const data = await res.json()
        if (data && data.parsedContext) {
          setChatContext(data.parsedContext)

          if (isInitialLoad && data.parsedContext.userLatitude !== undefined && data.parsedContext.userLongitude !== undefined) {
            setUserLatitude(data.parsedContext.userLatitude)
            setUserLongitude(data.parsedContext.userLongitude)
          }

          let rawMessages = data.parsedContext.messages
          if (!Array.isArray(rawMessages)) {
            rawMessages = [
              {
                sender: "bot",
                text: "👋 ¡Hola! Soy el asistente virtual de Metrolínea (SITME). 🤖\nTe ayudo a consultar rutas, ver la ocupación en tiempo real y evitar buses llenos.\n\n¿En qué estación te encuentras actualmente y hacia dónde te diriges?",
                timestamp: new Date().toISOString()
              }
            ]
          }

          const mapped = rawMessages.map((m: any) => ({
            sender: m.sender,
            text: m.text,
            timestamp: new Date(m.timestamp),
            isAudio: !!m.isAudio
          }))

          // Only update state if message content actually changed to avoid scroll-jumping
          const mappedStr = JSON.stringify(mapped)
          setMessages((prev) => {
            if (JSON.stringify(prev) !== mappedStr) {
              return mapped
            }
            return prev
          })
        }
      }
    } catch (err) {
      console.error("Error fetching chat:", err)
    }
  }

  // Poll all active chats
  const fetchActiveChats = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/whatsapp/chats`)
      if (res.ok) {
        const data = await res.json()
        setActiveChats(data)
      }
    } catch (err) {
      console.error("Error fetching active chats list:", err)
    }
  }

  useEffect(() => {
    fetchData()
    fetchActiveChats()
    const intervalData = setInterval(fetchData, 5000) // Poll stations/buses every 5s
    const intervalChats = setInterval(fetchActiveChats, 3000) // Poll active chats list every 3s
    return () => {
      clearInterval(intervalData)
      clearInterval(intervalChats)
    }
  }, [])

  useEffect(() => {
    fetchChat(true)
    const intervalChat = setInterval(() => fetchChat(false), 2000) // Poll selected chat log every 2s
    return () => {
      clearInterval(intervalChat)
    }
  }, [chatNumber])

  // Send message simulation (submits to backend simulator, which updates db, then polls)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText || !inputText.trim()) return

    const userMsgText = inputText
    setInputText("")
    setIsTyping(true)

    try {
      const response = await fetch(`${BACKEND_URL}/whatsapp/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: chatNumber,
          body: userMsgText,
          latitude: userLatitude,
          longitude: userLongitude,
        }),
      })

      if (!response.ok) throw new Error("Error in simulation webhook")

      // Immediately fetch updated chat history from backend database
      await fetchChat(false)
    } catch (error) {
      console.error(error)
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "❌ Error al procesar el mensaje en el backend.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  // Clear chat logs in the database
  const handleClearChat = async () => {
    if (!confirm(`¿Deseas reiniciar la conversación de ${chatNumber} en el servidor?`)) return
    try {
      const res = await fetch(`${BACKEND_URL}/whatsapp/chats/${chatNumber}`, {
        method: "DELETE"
      })
      if (res.ok) {
        await fetchChat(true)
      }
    } catch (err) {
      console.error("Error clearing chat:", err)
    }
  }

  // Simular envío de nota de voz (Audio)
  const handleSendVoiceNote = async () => {
    const audioText = prompt("Simular Nota de Voz - Escribe el texto que dirás en el audio:", "¿Cómo voy de Provenza a La Rosita?")
    if (audioText === null) return
    const textToSend = audioText.trim() || "¿Cómo voy de Provenza a La Rosita?"

    setIsTyping(true)
    try {
      const response = await fetch(`${BACKEND_URL}/whatsapp/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: chatNumber,
          body: textToSend,
          isAudio: true,
          latitude: userLatitude,
          longitude: userLongitude,
        }),
      })

      if (!response.ok) throw new Error("Error in simulation webhook")
      await fetchChat(false)
    } catch (error) {
      console.error(error)
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "❌ Error al procesar el audio simulado.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  // AI Analyze handlers
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAnalyzeImageFile(file)
      setAnalyzeImagePreview(URL.createObjectURL(file))
      setAnalyzeResult(null)
      setAnalyzeEtaResult(null)
      setAnalyzeError(null)
    }
  }

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!analyzeImageFile || !analyzeTargetId) {
      setAnalyzeError("Por favor selecciona una imagen y el objetivo a actualizar.")
      return
    }

    setIsAnalyzing(true)
    setAnalyzeError(null)
    setAnalyzeResult(null)

    const formData = new FormData()
    formData.append("image", analyzeImageFile)
    formData.append("targetType", analyzeTargetType)
    formData.append("targetId", analyzeTargetId)
    if (analyzeLatitude) {
      formData.append("latitude", analyzeLatitude)
    }
    if (analyzeLongitude) {
      formData.append("longitude", analyzeLongitude)
    }

    try {
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Error al procesar la imagen.")
      }

      const data = await response.json()
      setAnalyzeResult(data.result)

      // For buses: calcula y persiste el ETA a cada estación de la ruta
      setAnalyzeEtaResult(null)
      if (analyzeTargetType === "bus") {
        const routeData = computeRouteEtas()
        const validStops = routeData?.stops.filter((s) => s.etaMin != null) ?? []
        if (validStops.length > 0) {
          await Promise.all(
            validStops.map((stop) =>
              fetch(`${BACKEND_URL}/buses/${analyzeTargetId}/eta`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  stationId: stop.station.id,
                  etaMinutes: stop.etaMin,
                  latitude: analyzeLatitude,
                  longitude: analyzeLongitude,
                }),
              }).catch(() => null)
            )
          )
          setAnalyzeEtaResult(validStops.length)
        }
      }

      // Refresh list of stations/buses so the rest of the UI matches the new data!
      await fetchData()
    } catch (err: any) {
      console.error(err)
      setAnalyzeError(err.message || "No se pudo conectar con el servidor de análisis.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Open the YOLOv8 AI Analyzer pre-targeted to a telemetry row
  const openAnalyzerFor = (type: "station" | "bus", id: number) => {
    setActiveTab("ai_analyze")
    setAnalyzeTargetType(type)
    setAnalyzeTargetId(id.toString())
    setAnalyzeResult(null)
    setAnalyzeEtaResult(null)
    setAnalyzeError(null)
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  // Open the ETA calculator modal for a bus row
  const openEtaCalculator = (bus: Bus) => {
    setEtaBus(bus)
    setEtaSpeed("25")
    setEtaLat(bus.latitude != null ? bus.latitude.toString() : userLatitude.toString())
    setEtaLon(bus.longitude != null ? bus.longitude.toString() : userLongitude.toString())
    setEtaDestStationId("")
    setEtaSaveMsg(null)
  }

  // Shared ETA estimator: distancia Haversine + tiempo = distancia / velocidad
  const estimateEta = (latStr: string, lonStr: string, speedStr: string, destStationId: string) => {
    const dest = stations.find((s) => s.id.toString() === destStationId)
    const speed = parseFloat(speedStr)
    const lat = parseFloat(latStr)
    const lon = parseFloat(lonStr)

    if (
      !dest ||
      dest.latitude == null ||
      dest.longitude == null ||
      isNaN(lat) ||
      isNaN(lon)
    ) {
      return { distKm: null as number | null, etaMin: null as number | null }
    }

    const distKm = haversineKm(lat, lon, dest.latitude, dest.longitude)
    const etaMin = speed > 0 ? Math.round((distKm / speed) * 60) : null
    return { distKm, etaMin }
  }

  // Compute the live ETA from the modal inputs
  const computeEta = () => estimateEta(etaLat, etaLon, etaSpeed, etaDestStationId)

  // Compute cumulative ETA to each station along the analyzer bus's route
  const computeRouteEtas = () => {
    const bus = buses.find((b) => b.id.toString() === analyzeTargetId)
    if (!bus || bus.routeId == null) return null
    const route = routes.find((r) => r.id === bus.routeId)
    if (!route || !route.routeStations?.length) return null

    const speed = parseFloat(analyzeSpeed)
    const lat = parseFloat(analyzeLatitude)
    const lon = parseFloat(analyzeLongitude)
    const hasOrigin = !isNaN(lat) && !isNaN(lon)

    const ordered = [...route.routeStations].sort((a, b) => a.sequenceOrder - b.sequenceOrder)

    let acc = 0
    let prevLat = lat
    let prevLon = lon
    const stops = ordered.map((rs) => {
      const st = rs.station
      let cumDistKm: number | null = null
      let etaMin: number | null = null
      if (hasOrigin && st.latitude != null && st.longitude != null) {
        acc += haversineKm(prevLat, prevLon, st.latitude, st.longitude)
        cumDistKm = Math.round(acc * 10) / 10
        etaMin = speed > 0 ? Math.round((acc / speed) * 60) : null
        prevLat = st.latitude
        prevLon = st.longitude
      }
      return { routeStationId: rs.id, station: st, sequenceOrder: rs.sequenceOrder, cumDistKm, etaMin }
    })

    return { route, stops, hasOrigin }
  }

  // Persist the computed ETA (feeds the SITME assistant via arrivals table)
  const handleSaveEta = async () => {
    if (!etaBus || !etaDestStationId) return
    const { etaMin } = computeEta()
    if (etaMin == null) return

    setEtaSaving(true)
    setEtaSaveMsg(null)
    try {
      const res = await fetch(`${BACKEND_URL}/buses/${etaBus.id}/eta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationId: Number(etaDestStationId),
          etaMinutes: etaMin,
          latitude: etaLat,
          longitude: etaLon,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Error al guardar el ETA")
      }
      setEtaSaveMsg("✅ ETA registrado y enviado al asistente SITME.")
      await fetchData()
    } catch (err: any) {
      setEtaSaveMsg("❌ " + (err.message || "No se pudo guardar el ETA."))
    } finally {
      setEtaSaving(false)
    }
  }

  // Update Station Occupancy (YOLOv8 simulation)
  const handleUpdateStation = async (occupancyLevel: "LOW" | "MEDIUM" | "HIGH", passengerCount: number) => {
    if (!selectedStation) return
    try {
      const response = await fetch(`${BACKEND_URL}/stations/${selectedStation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupancyLevel, passengerCount }),
      })

      if (response.ok) {
        const data = await response.json()
        setStations((prev) =>
          prev.map((s) => (s.id === selectedStation.id ? data.station : s))
        )
        setSelectedStation(null)
      }
    } catch (error) {
      console.error("Error updating station occupancy:", error)
    }
  }

  // Update Bus Occupancy (Vision sensor simulation)
  const handleUpdateBus = async (
    occupancyLevel: "LOW" | "MEDIUM" | "HIGH",
    passengerCount: number,
    status: "IN_TRANSIT" | "STOPPED" | "OUT_OF_SERVICE"
  ) => {
    if (!selectedBus) return
    try {
      const response = await fetch(`${BACKEND_URL}/buses/${selectedBus.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupancyLevel, passengerCount, status }),
      })

      if (response.ok) {
        const data = await response.json()
        setBuses((prev) => prev.map((b) => (b.id === selectedBus.id ? data.bus : b)))
        setSelectedBus(null)
      }
    } catch (error) {
      console.error("Error updating bus:", error)
    }
  }

  // Color helper functions
  const getOccupancyBadge = (level: "LOW" | "MEDIUM" | "HIGH") => {
    switch (level) {
      case "HIGH":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20"
      case "MEDIUM":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20"
      case "LOW":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
      default:
        return "bg-slate-500/10 text-slate-400 border border-slate-500/20"
    }
  }

  const getOccupancyBullet = (level: "LOW" | "MEDIUM" | "HIGH") => {
    switch (level) {
      case "HIGH":
        return "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
      case "MEDIUM":
        return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
      case "LOW":
        return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
      default:
        return "bg-slate-500"
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased select-none">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-lg text-white font-bold shadow-lg shadow-emerald-500/20">
            MIB
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-50">
              Metrolínea Control Center
            </h1>
            <p className="text-xs text-slate-400">
              Sistema Sinérgico de Gestión de Aglomeración e IA Conversacional
            </p>
          </div>
        </div>

        {/* System Sync Indicators */}
        <div className="flex items-center gap-4">
          {syncError ? (
            <div className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              {syncError}
            </div>
          ) : (
            <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Sincronizado (Localhost:3333)
            </div>
          )}

          <button
            onClick={fetchData}
            disabled={isSyncing}
            className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700/50"
            title="Sincronizar ahora"
          >
            <svg
              className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-[1600px] mx-auto w-full">
        {/* Left/Middle Column (8 cols): Monitoring Dashboard */}
        <main className="lg:col-span-8 flex flex-col gap-6">
          {/* Sinergia Overview banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600/20 to-teal-600/10 border border-emerald-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 shadow-xl shadow-emerald-950/20">
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-lg font-bold text-emerald-300">
                La Sinergia en Acción
              </h2>
              <p className="text-sm text-slate-300 mt-1 max-w-xl">
                Modifica los datos de ocupación de las estaciones en el panel de abajo (simulando los sensores de YOLOv8). El chatbot de la derecha adaptará sus consejos en tiempo real para redirigir a los pasajeros hacia el bus vacío.
              </p>
            </div>
            <div className="px-4 py-3 bg-slate-900/80 border border-slate-700/50 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600/20 rounded-full flex items-center justify-center text-emerald-400">
                🤖
              </div>
              <div className="text-left">
                <div className="text-xs text-slate-400 font-medium">Gemini AI Engine</div>
                <div className="text-xs font-bold text-slate-100">
                  {whatsappStatus.hasGeminiKey ? "Activo (Gemini API)" : "Simulador Local Activo"}
                </div>
              </div>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex border-b border-slate-800 gap-4 mb-4 mt-2">
            <button
              onClick={() => setActiveTab("monitor")}
              className={`pb-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${activeTab === "monitor"
                  ? "border-emerald-500 text-emerald-400 font-extrabold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              📊 Centro de Monitoreo
            </button>
            <button
              onClick={() => setActiveTab("ai_analyze")}
              className={`pb-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${activeTab === "ai_analyze"
                  ? "border-emerald-500 text-emerald-400 font-extrabold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
            >
              👁️ Analizador IA (YOLOv8 & FiftyOne)
            </button>
          </div>

          {activeTab === "monitor" ? (
            <>
              {/* Grid for Stations and Buses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stations Monitor Card */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-200 flex items-center gap-2">
                      <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Monitoreo de Estaciones (YOLOv8)
                    </h3>
                    <span className="text-xs text-slate-400">Cámaras MIB</span>
                  </div>

                  {/* Stations List */}
                  <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
                    {stations.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => setSelectedStation(s)}
                        className="p-3 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${getOccupancyBullet(s.occupancyLevel)}`} />
                          <div className="text-left">
                            <div className="font-medium text-sm text-slate-200">{s.name}</div>
                            <div className="text-xs text-slate-400 truncate max-w-[200px]">{s.location || "Sin coordenadas"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getOccupancyBadge(s.occupancyLevel)}`}>
                            {s.occupancyLevel}
                          </span>
                          <span className="text-xs text-slate-300 font-mono font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                            👥 {s.passengerCount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Buses Fleet Card */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-200 flex items-center gap-2">
                      <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      Flota y Ocupación de Buses
                    </h3>
                    <span className="text-xs text-slate-400">GPS / Sensores</span>
                  </div>

                  {/* Buses List */}
                  <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto pr-1">
                    {buses.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBus(b)}
                        className="p-3 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="p-1.5 bg-slate-800 rounded-lg text-xs font-bold text-teal-400 border border-slate-700">
                            🚌 {b.plate}
                          </span>
                          <div className="text-left">
                            <div className="font-medium text-sm text-slate-200">
                              Ruta {b.route ? b.route.name : "Sin ruta"}
                            </div>
                            <div className="text-xs text-slate-400">
                              {b.status === "IN_TRANSIT" ? "🟢 En tránsito" : b.status === "STOPPED" ? "🟡 Detenido" : "🔴 Fuera de servicio"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getOccupancyBadge(b.occupancyLevel)}`}>
                            {b.occupancyLevel}
                          </span>
                          <span className="text-xs text-slate-300 font-mono font-bold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                            👥 {b.passengerCount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Telemetry Table Card */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm md:text-base">
                      <span className="text-emerald-500">📋</span>
                      Tabla de Telemetría (Estaciones y Buses)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Filtra y busca ubicaciones en tiempo real y aforos del sistema Metrolínea.
                    </p>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Filter Type Buttons */}
                    <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setTableFilterType("all")}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${tableFilterType === "all"
                            ? "bg-emerald-600 text-white font-extrabold"
                            : "text-slate-400 hover:text-slate-200"
                          }`}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => setTableFilterType("stations")}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${tableFilterType === "stations"
                            ? "bg-emerald-600 text-white font-extrabold"
                            : "text-slate-400 hover:text-slate-200"
                          }`}
                      >
                        Estaciones
                      </button>
                      <button
                        type="button"
                        onClick={() => setTableFilterType("buses")}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${tableFilterType === "buses"
                            ? "bg-emerald-600 text-white font-extrabold"
                            : "text-slate-400 hover:text-slate-200"
                          }`}
                      >
                        Buses
                      </button>
                    </div>

                    {/* Search Input */}
                    <input
                      type="text"
                      placeholder="Buscar por nombre..."
                      value={tableSearchQuery}
                      onChange={(e) => setTableSearchQuery(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg text-xs px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-200 w-44"
                    />
                  </div>
                </div>

                {/* Combined list logic */}
                {(() => {
                  const combined = [
                    ...stations.map((s) => ({
                      id: `station-${s.id}`,
                      type: "station",
                      name: s.name,
                      detail: s.location || "Sin dirección",
                      occupancyLevel: s.occupancyLevel,
                      passengerCount: s.passengerCount,
                      latitude: s.latitude,
                      longitude: s.longitude,
                    })),
                    ...buses.map((b) => ({
                      id: `bus-${b.id}`,
                      type: "bus",
                      name: `Bus ${b.plate}`,
                      detail: b.route ? `Ruta ${b.route.name} (${b.route.description || ""})` : "Sin ruta",
                      occupancyLevel: b.occupancyLevel,
                      passengerCount: b.passengerCount,
                      latitude: b.latitude,
                      longitude: b.longitude,
                    })),
                  ]

                  const filtered = combined.filter((item) => {
                    if (tableFilterType === "stations" && item.type !== "station") return false
                    if (tableFilterType === "buses" && item.type !== "bus") return false

                    if (tableSearchQuery.trim()) {
                      const q = tableSearchQuery.toLowerCase()
                      return (
                        item.name.toLowerCase().includes(q) ||
                        item.detail.toLowerCase().includes(q) ||
                        item.occupancyLevel.toLowerCase().includes(q)
                      )
                    }
                    return true
                  })

                  return (
                    <div className="overflow-x-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            <th className="p-3.5">Tipo</th>
                            <th className="p-3.5">Identificación / Nombre</th>
                            <th className="p-3.5">Detalle / Ruta</th>
                            <th className="p-3.5">Coordenadas (GPS)</th>
                            <th className="p-3.5">Ocupación</th>
                            <th className="p-3.5 text-right">Pasajeros</th>
                            <th className="p-3.5 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                          {filtered.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-6 text-center text-slate-500 italic">
                                No se encontraron registros con los filtros aplicados.
                              </td>
                            </tr>
                          ) : (
                            filtered.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="p-3.5 font-bold">
                                  {item.type === "station" ? (
                                    <span className="text-emerald-400 flex items-center gap-1">🏢 Estación</span>
                                  ) : (
                                    <span className="text-teal-400 flex items-center gap-1">🚌 Autobús</span>
                                  )}
                                </td>
                                <td className="p-3.5 font-semibold text-slate-100">{item.name}</td>
                                <td className="p-3.5 text-slate-400">{item.detail}</td>
                                <td className="p-3.5 font-mono text-xs text-slate-400">
                                  {item.latitude !== undefined && item.latitude !== null && item.longitude !== undefined && item.longitude !== null ? (
                                    <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                      {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600 italic">Sin coordenadas</span>
                                  )}
                                </td>
                                <td className="p-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getOccupancyBadge(item.occupancyLevel)}`}>
                                    {item.occupancyLevel}
                                  </span>
                                </td>
                                <td className="p-3.5 text-right font-bold text-slate-200">{item.passengerCount}</td>
                                <td className="p-3.5">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openAnalyzerFor(item.type as "station" | "bus", Number(item.id.split("-")[1]))}
                                      className="px-2 py-1 text-[10px] font-bold rounded-md bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors cursor-pointer whitespace-nowrap"
                                      title="Abrir Analizador IA (YOLOv8) para este objetivo"
                                    >
                                      👁️ Analizar IA
                                    </button>
                                    {item.type === "bus" && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const b = buses.find((x) => `bus-${x.id}` === item.id)
                                          if (b) openEtaCalculator(b)
                                        }}
                                        className="px-2 py-1 text-[10px] font-bold rounded-md bg-teal-600/15 text-teal-300 border border-teal-500/30 hover:bg-teal-600/30 transition-colors cursor-pointer whitespace-nowrap"
                                        title="Calcular tiempo estimado de llegada (ETA)"
                                      >
                                        🕐 ETA
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )
                })()}
              </div>

              {/* Routes Sequence Card */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md">
                <h3 className="font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Mapa y Secuencia de Paradas (Rutas Activas)
                </h3>

                <div className="flex flex-col gap-6">
                  {routes.map((r) => (
                    <div key={r.id} className="p-4 bg-slate-800/20 border border-slate-800 rounded-xl">
                      <div className="flex justify-between items-center mb-3">
                        <span className="px-2.5 py-1 bg-amber-500 text-slate-950 font-extrabold text-sm rounded">
                          Ruta {r.name}
                        </span>
                        <span className="text-xs text-slate-400 italic">
                          {r.description || "Sin descripción"}
                        </span>
                      </div>

                      {/* Horizontal stops view */}
                      <div className="flex items-center overflow-x-auto py-2 gap-4 scrollbar-thin scrollbar-thumb-slate-800">
                        {r.routeStations.map((rs, idx) => (
                          <div key={rs.id} className="flex items-center gap-3 flex-shrink-0">
                            <div className="relative flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full border-2 ${rs.station.occupancyLevel === "HIGH" ? "border-rose-500 bg-rose-950 text-rose-300" : rs.station.occupancyLevel === "MEDIUM" ? "border-amber-500 bg-amber-950 text-amber-300" : "border-emerald-500 bg-emerald-950 text-emerald-300"} flex items-center justify-center font-bold text-xs`}>
                                {rs.sequenceOrder}
                              </div>
                              <span className="text-xs font-semibold text-slate-200 mt-2 max-w-[100px] text-center truncate">
                                {rs.station.name.replace("Estación ", "")}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded-full mt-1 ${getOccupancyBadge(rs.station.occupancyLevel)}`}>
                                {rs.station.occupancyLevel}
                              </span>
                            </div>

                            {idx < r.routeStations.length - 1 && (
                              <div className="h-0.5 w-8 bg-slate-700 flex-shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-6 text-left">
              <div>
                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Analizador Inteligente de Ocupación por Fotograma
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Sube una imagen o fotograma capturado para contar personas usando el modelo YOLOv8 pre-entrenado y registrarlo en FiftyOne.
                </p>
              </div>

              <form onSubmit={handleRunAnalysis} className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Configuration form (5 cols) */}
                <div className="md:col-span-5 flex flex-col gap-4">
                  {/* Target Type selector */}
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">
                      1. Tipo de Objetivo:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAnalyzeTargetType("station")
                          setAnalyzeTargetId("")
                          setAnalyzeResult(null)
                        }}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${analyzeTargetType === "station"
                            ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 font-extrabold"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                          }`}
                      >
                        Estación
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAnalyzeTargetType("bus")
                          setAnalyzeTargetId("")
                          setAnalyzeResult(null)
                        }}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${analyzeTargetType === "bus"
                            ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 font-extrabold"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
                          }`}
                      >
                        Autobús
                      </button>
                    </div>
                  </div>

                  {/* Target List Dropdown */}
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">
                      2. Seleccionar {analyzeTargetType === "station" ? "Estación" : "Autobús"} específico:
                    </label>
                    <select
                      value={analyzeTargetId}
                      onChange={(e) => {
                        setAnalyzeTargetId(e.target.value)
                        setAnalyzeResult(null)
                        setAnalyzeEtaResult(null)
                      }}
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-2.5 focus:ring-1 focus:ring-emerald-500 text-slate-200 cursor-pointer"
                    >
                      <option value="">-- Seleccionar --</option>
                      {analyzeTargetType === "station"
                        ? stations.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (Actual: {s.passengerCount} pers.)
                          </option>
                        ))
                        : buses.map((b) => (
                          <option key={b.id} value={b.id}>
                            Bus {b.plate} - Ruta {b.route ? b.route.name : "Sin Ruta"} (Actual: {b.passengerCount} pers.)
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Coordinate Inputs */}
                  {analyzeTargetId && (
                    <div className="grid grid-cols-2 gap-2 bg-slate-800/20 p-3 rounded-lg border border-slate-800">
                      <div className="col-span-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">
                        📍 Coordenadas en Tiempo Real (GPS)
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Latitud:</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={analyzeLatitude}
                          onChange={(e) => setAnalyzeLatitude(e.target.value)}
                          placeholder="Ej: 7.0945"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-2 text-slate-200 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Longitud:</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={analyzeLongitude}
                          onChange={(e) => setAnalyzeLongitude(e.target.value)}
                          placeholder="Ej: -73.1118"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-2 text-slate-200 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* ETA por ruta (solo buses): velocidad + tiempo de llegada a cada estación */}
                  {analyzeTargetId && analyzeTargetType === "bus" && (
                    <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                          🕐 Tiempo de Llegada por Ruta (ETA)
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] text-slate-500">Velocidad:</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={analyzeSpeed}
                            onChange={(e) => setAnalyzeSpeed(e.target.value)}
                            placeholder="25"
                            className="w-16 bg-slate-800 border border-slate-700 rounded-lg text-xs p-1.5 text-slate-200 focus:ring-1 focus:ring-teal-500 text-center"
                          />
                          <span className="text-[10px] text-slate-500">km/h</span>
                        </div>
                      </div>

                      {(() => {
                        const routeData = computeRouteEtas()
                        if (!routeData) {
                          return (
                            <p className="text-[10px] text-slate-500 italic">
                              Este bus no tiene una ruta con estaciones asignada.
                            </p>
                          )
                        }
                        if (!routeData.hasOrigin) {
                          return (
                            <p className="text-[10px] text-amber-400 italic">
                              Ingresa la latitud y longitud del bus (arriba) para calcular el ETA a cada estación.
                            </p>
                          )
                        }
                        return (
                          <div className="flex flex-col gap-1.5">
                            <div className="text-[10px] text-slate-400">
                              Ruta <span className="font-bold text-amber-400">{routeData.route.name}</span>
                              {routeData.route.description ? ` — ${routeData.route.description}` : ""}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              {routeData.stops.map((stop) => (
                                <div
                                  key={stop.routeStationId}
                                  className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-800/60 last:border-0"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-5 h-5 flex-shrink-0 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold flex items-center justify-center text-slate-300">
                                      {stop.sequenceOrder}
                                    </span>
                                    <span className="text-slate-200 truncate">{stop.station.name}</span>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="font-mono text-[10px] text-slate-500">
                                      {stop.cumDistKm != null ? `${stop.cumDistKm} km` : "—"}
                                    </span>
                                    <span className="font-mono font-bold text-emerald-400 w-14 text-right">
                                      {stop.etaMin != null ? `${stop.etaMin} min` : "—"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      <p className="text-[9px] text-slate-500">
                        ETA acumulado a lo largo de la ruta desde la posición del bus. Se guarda para cada estación al procesar el análisis.
                      </p>
                    </div>
                  )}

                  {/* Image selection file input */}
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">
                      3. Cargar Fotograma:
                    </label>
                    <div className="relative border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-4 transition-colors flex flex-col items-center justify-center bg-slate-800/10 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        required={!analyzeImagePreview}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="flex flex-col items-center gap-1.5 text-center text-slate-400">
                        <span className="text-xl">📁</span>
                        <span className="text-xs font-semibold text-slate-300">
                          {analyzeImageFile ? analyzeImageFile.name : "Seleccionar Imagen"}
                        </span>
                        <span className="text-[10px]">Formatos aceptados: JPG, PNG, WEBP</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isAnalyzing || !analyzeImageFile || !analyzeTargetId}
                    className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-bold font-sans transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
                  >
                    {isAnalyzing ? "Analizando fotograma..." : "🚀 Procesar con YOLOv8 & FiftyOne"}
                  </button>

                  {analyzeError && (
                    <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 mt-2">
                      ⚠️ {analyzeError}
                    </div>
                  )}
                </div>

                {/* Preview / Results Area (7 cols) */}
                <div className="md:col-span-7 flex flex-col gap-4 border-l border-slate-800 md:pl-6">
                  {analyzeImagePreview ? (
                    <div className="flex flex-col gap-4">
                      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
                        <img
                          src={analyzeImagePreview}
                          alt="Previsualización"
                          className="max-h-full max-w-full object-contain"
                        />
                        {isAnalyzing && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-emerald-300 font-bold animate-pulse">
                              Corriendo inferencia con PyTorch en segundo plano...
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Display Results */}
                      {analyzeResult && (
                        <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex flex-col gap-3 animate-fade-in text-left">
                          <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                            ✅ Análisis Completado con Éxito
                          </h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                              <div className="text-[10px] text-slate-400 font-medium">Pasajeros Detectados</div>
                              <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                                👥 {analyzeResult.passenger_count}
                              </div>
                            </div>
                            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                              <div className="text-[10px] text-slate-400 font-medium">Ocupación Estimada</div>
                              <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                                📈 {Math.round((analyzeResult.passenger_count / (analyzeTargetType === "station" ? 150 : 60)) * 100)}%
                              </div>
                            </div>
                            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                              <div className="text-[10px] text-slate-400 font-medium">Nivel de Aforo</div>
                              <div className="mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getOccupancyBadge(analyzeResult.occupancy_level)}`}>
                                  {analyzeResult.occupancy_level}
                                </span>
                              </div>
                            </div>
                          </div>

                          {analyzeEtaResult != null && (
                            <div className="text-xs text-teal-200 bg-teal-950/30 p-2.5 rounded border border-teal-500/20 leading-relaxed">
                              🕐 *ETA registrado:* se calculó y guardó el tiempo de llegada a **{analyzeEtaResult} estaciones** de la ruta (velocidad {analyzeSpeed} km/h). Los datos fueron enviados al asistente SITME.
                            </div>
                          )}

                          <div className="text-xs text-slate-300 bg-slate-900/50 p-2.5 rounded border border-slate-800 mt-1 leading-relaxed">
                            💡 *Sinergia Metrolínea:* La base de datos ha sido actualizada. En la base de datos de FiftyOne se ha registrado este fotograma con la etiqueta del identificador `{analyzeResult.bus_id}` y el tiempo de inferencia fue de **{analyzeResult.inference_ms} ms**.
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full min-h-[250px] border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2">
                      <span className="text-3xl">👁️</span>
                      <span className="text-xs font-semibold">Esperando carga de imagen para análisis</span>
                      <span className="text-[10px]">Selecciona el objetivo y sube un fotograma a la izquierda</span>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}
        </main>

        {/* Right Column (4 cols): WhatsApp Assistant Simulator */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          {/* Phone Frame wrapper */}
          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-4 pt-10 pb-6 shadow-2xl relative flex flex-col h-[650px] max-w-[380px] mx-auto w-full ring-8 ring-slate-800/80">
            {/* Speaker bar */}
            <div className="w-24 h-4 bg-slate-800 rounded-full absolute top-4 left-1/2 -translate-x-1/2 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-slate-950" />
            </div>

            {/* Mobile screen */}
            <div className="flex-1 bg-[#0b141a] rounded-[2rem] overflow-hidden flex flex-col border border-slate-950 relative">
              {/* WhatsApp header */}
              <div className="bg-[#1f2c34] p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white shadow-md flex-shrink-0">
                    🚌
                  </div>
                  <div className="text-left min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chat:</span>
                      <select
                        value={chatNumber}
                        onChange={(e) => setChatNumber(e.target.value)}
                        className="bg-[#2a3942] text-slate-100 text-xs font-bold rounded-lg px-2 py-1 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[130px] cursor-pointer"
                        title="Selecciona la conversación"
                      >
                        <option value={DEFAULT_PHONE}>+573126078359 (Simulador)</option>
                        {activeChats
                          .filter((c) => c.phoneNumber !== DEFAULT_PHONE)
                          .map((c) => (
                            <option key={c.phoneNumber} value={c.phoneNumber}>
                              +{c.phoneNumber}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Monitoreo en Vivo (SITME)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1 rounded bg-slate-800 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/20 transition-all cursor-pointer flex-shrink-0"
                  title="Reiniciar conversación"
                >
                  Limpiar
                </button>
              </div>

              {/* WhatsApp Chat area */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`max-w-[85%] rounded-xl p-3 text-sm leading-relaxed ${m.sender === "user"
                      ? "bg-[#005c4b] text-slate-50 self-end rounded-tr-none"
                      : "bg-[#202c33] text-slate-100 self-start rounded-tl-none border border-slate-800"
                      }`}
                    style={{ whiteSpace: "pre-line" }}
                  >
                    {m.isAudio ? (
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 cursor-pointer active:scale-95 transition-all"
                          >
                            <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                          <div className="flex-1 flex items-end gap-0.5 h-6 pb-1">
                            {[2, 3, 5, 2, 4, 6, 8, 5, 3, 6, 7, 4, 3, 5, 2, 4].map((h, i) => (
                              <span
                                key={i}
                                className="w-[3px] bg-emerald-400 rounded-full"
                                style={{ height: `${h * 10}%` }}
                              />
                            ))}
                          </div>
                          <span className="text-emerald-400 text-sm flex-shrink-0 ml-1">
                            🎙️
                          </span>
                        </div>
                        <div className="text-xs text-emerald-100/90 italic border-t border-emerald-800/40 pt-1.5 mt-0.5">
                          🎤 {m.text}
                        </div>
                      </div>
                    ) : (
                      m.text
                    )}
                    <div className="text-[10px] text-right text-slate-400 mt-1">
                      {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="bg-[#202c33] text-slate-400 self-start rounded-xl rounded-tl-none p-3 text-xs border border-slate-800 max-w-[80%] flex items-center gap-1.5">
                    <span>MIB está escribiendo</span>
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* WhatsApp footer Input bar */}
              <form onSubmit={handleSendMessage} className="bg-[#1f2c34] p-2 flex items-center gap-2 border-t border-slate-950">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                  className="flex-1 bg-[#2a3942] text-slate-100 placeholder-slate-400 text-sm rounded-lg px-3 py-2 border-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {inputText.trim() ? (
                  <button
                    type="submit"
                    className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f72] active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                  >
                    <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendVoiceNote}
                    className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f72] active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
                    title="Simular Nota de Voz (Audio)"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  </button>
                )}
              </form>
            </div>

            {/* Simulated Phone info */}
            <div className="text-center text-[10px] text-slate-500 mt-2">
              Prueba: Escribe "Provenza a La Rosita" o "ocupacion"
            </div>
          </div>

          {/* Telemetry coordinate simulator panel */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-md flex flex-col gap-3 text-left">
            <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <span>📍 Mi Ubicación de Pruebas (GPS)</span>
            </h4>
            <p className="text-[10px] text-slate-400">
              Establece tus coordenadas de prueba. SITME usará esta ubicación para calcular distancias Haversine y ETAs dinámicos.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Latitud:</label>
                <input
                  type="number"
                  step="0.000001"
                  value={userLatitude}
                  onChange={(e) => setUserLatitude(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg text-xs p-2 text-emerald-400 font-mono"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Longitud:</label>
                <input
                  type="number"
                  step="0.000001"
                  value={userLongitude}
                  onChange={(e) => setUserLongitude(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg text-xs p-2 text-emerald-400 font-mono"
                />
              </div>
            </div>

            {/* Quick preset selector dropdown */}
            <div>
              <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Simular ubicación en Estación:</label>
              <select
                onChange={(e) => {
                  if (!e.target.value) return
                  const [latStr, lonStr] = e.target.value.split(",")
                  setUserLatitude(parseFloat(latStr))
                  setUserLongitude(parseFloat(lonStr))
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-2 cursor-pointer text-slate-200"
              >
                <option value="">-- Seleccionar Estación --</option>
                {stations.map((st) => (
                  <option key={st.id} value={`${st.latitude},${st.longitude}`}>
                    📍 {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Simulator Console & QR Code display */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-4">
            <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Conexión Bot WhatsApp Web JS
            </h3>

            {/* Connection Status Box */}
            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-left">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Estado del bot:</span>
                <span className={`text-xs font-bold ${whatsappStatus.status === "CONNECTED" ? "text-emerald-400" : whatsappStatus.status === "QR_READY" ? "text-amber-400 animate-pulse" : "text-slate-400"}`}>
                  {whatsappStatus.status}
                </span>
              </div>

              {whatsappStatus.status === "QR_READY" && whatsappStatus.qr && (
                <div className="mt-4 flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-lg border border-slate-200">
                  <div className="text-slate-800 text-xs font-bold mb-2">Escanea este QR con tu celular:</div>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(whatsappStatus.qr)}`}
                    alt="WhatsApp QR Code"
                    width={200}
                    height={200}
                    className="border border-slate-200 rounded-lg"
                  />
                  <span className="text-[10px] text-slate-500 text-center mt-1">SITME Bot Metrolínea</span>
                </div>
              )}

              {whatsappStatus.errorMessage && (
                <div className="mt-2 text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
                  {whatsappStatus.errorMessage}
                </div>
              )}
            </div>

            {/* Conversation state logs */}
            <div className="text-left bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="text-xs text-slate-400 font-bold mb-1">State Context (JSON):</div>
              <pre className="text-[10px] font-mono text-emerald-400 overflow-x-auto">
                {JSON.stringify(chatContext, null, 2)}
              </pre>
            </div>
          </div>
        </aside>
      </div>

      {/* MODAL: Edit Station Occupancy (YOLOv8 simulation) */}
      {selectedStation && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 text-left shadow-2xl">
            <div>
              <h4 className="font-bold text-slate-100 text-base">{selectedStation.name}</h4>
              <p className="text-xs text-slate-400 mt-0.5">Simular reporte de cámara YOLOv8</p>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Nivel de Aglomeración:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["LOW", "MEDIUM", "HIGH"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => handleUpdateStation(level, selectedStation.passengerCount)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${selectedStation.occupancyLevel === level
                        ? level === "HIGH"
                          ? "bg-rose-500/20 border-rose-500 text-rose-300"
                          : level === "MEDIUM"
                            ? "bg-amber-500/20 border-amber-500 text-amber-300"
                            : "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Contador de Personas: {selectedStation.passengerCount}</label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={selectedStation.passengerCount}
                  onChange={(e) => {
                    const count = parseInt(e.target.value)
                    // Determine occupancy based on slider
                    let level: "LOW" | "MEDIUM" | "HIGH" = "LOW"
                    if (count > 100) level = "HIGH"
                    else if (count > 40) level = "MEDIUM"

                    setStations((prev) =>
                      prev.map((s) => (s.id === selectedStation.id ? { ...s, passengerCount: count, occupancyLevel: level } : s))
                    )
                    setSelectedStation((prev) => (prev ? { ...prev, passengerCount: count, occupancyLevel: level } : null))
                  }}
                  className="w-full accent-emerald-500 cursor-ew-resize bg-slate-800 h-1.5 rounded-lg appearance-none"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => setSelectedStation(null)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateStation(selectedStation.occupancyLevel, selectedStation.passengerCount)}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-colors cursor-pointer"
              >
                Guardar Reporte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Edit Bus status & Occupancy */}
      {selectedBus && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 text-left shadow-2xl">
            <div>
              <h4 className="font-bold text-slate-100 text-base">Bus {selectedBus.plate}</h4>
              <p className="text-xs text-slate-400 mt-0.5">Simular estado del autobús</p>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Nivel de Llenado:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["LOW", "MEDIUM", "HIGH"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => handleUpdateBus(level, selectedBus.passengerCount, selectedBus.status)}
                      className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${selectedBus.occupancyLevel === level
                        ? level === "HIGH"
                          ? "bg-rose-500/20 border-rose-500 text-rose-300"
                          : level === "MEDIUM"
                            ? "bg-amber-500/20 border-amber-500 text-amber-300"
                            : "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Pasajeros a Bordo: {selectedBus.passengerCount}</label>
                <input
                  type="range"
                  min="0"
                  max="120"
                  value={selectedBus.passengerCount}
                  onChange={(e) => {
                    const count = parseInt(e.target.value)
                    let level: "LOW" | "MEDIUM" | "HIGH" = "LOW"
                    if (count > 75) level = "HIGH"
                    else if (count > 30) level = "MEDIUM"

                    setBuses((prev) =>
                      prev.map((b) => (b.id === selectedBus.id ? { ...b, passengerCount: count, occupancyLevel: level } : b))
                    )
                    setSelectedBus((prev) => (prev ? { ...prev, passengerCount: count, occupancyLevel: level } : null))
                  }}
                  className="w-full accent-teal-500 cursor-ew-resize bg-slate-800 h-1.5 rounded-lg appearance-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Estado de Operación:</label>
                <select
                  value={selectedBus.status}
                  onChange={(e: any) => {
                    const status = e.target.value
                    setBuses((prev) =>
                      prev.map((b) => (b.id === selectedBus.id ? { ...b, status } : b))
                    )
                    setSelectedBus((prev) => (prev ? { ...prev, status } : null))
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-2 focus:ring-1 focus:ring-teal-500 text-slate-200"
                >
                  <option value="IN_TRANSIT">En tránsito</option>
                  <option value="STOPPED">Detenido</option>
                  <option value="OUT_OF_SERVICE">Fuera de servicio</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => setSelectedBus(null)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleUpdateBus(selectedBus.occupancyLevel, selectedBus.passengerCount, selectedBus.status)}
                className="px-3 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-500 rounded-lg text-white transition-colors cursor-pointer"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ETA Calculator (velocidad + GPS → tiempo de llegada) */}
      {etaBus && (() => {
        const { distKm, etaMin } = computeEta()
        const dest = stations.find((s) => s.id.toString() === etaDestStationId)
        return (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full flex flex-col gap-4 text-left shadow-2xl">
              <div>
                <h4 className="font-bold text-slate-100 text-base flex items-center gap-2">
                  🕐 Calcular ETA — Bus {etaBus.plate}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ingresa la velocidad y posición GPS del bus para estimar cuánto tarda en llegar a una estación.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">Velocidad del bus (km/h):</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={etaSpeed}
                    onChange={(e) => setEtaSpeed(e.target.value)}
                    placeholder="Ej: 25"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-2.5 text-slate-200 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Latitud del bus:</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={etaLat}
                    onChange={(e) => setEtaLat(e.target.value)}
                    placeholder="Ej: 7.0945"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-2.5 text-slate-200 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Longitud del bus:</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={etaLon}
                    onChange={(e) => setEtaLon(e.target.value)}
                    placeholder="Ej: -73.1118"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-2.5 text-slate-200 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-400 block mb-1">Estación de destino:</label>
                  <select
                    value={etaDestStationId}
                    onChange={(e) => setEtaDestStationId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-2.5 text-slate-200 focus:ring-1 focus:ring-teal-500 cursor-pointer"
                  >
                    <option value="">-- Seleccionar estación --</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.latitude == null || s.longitude == null}>
                        {s.name}{s.latitude == null || s.longitude == null ? " (sin coordenadas)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Result */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Distancia</div>
                  <div className="text-lg font-bold font-mono text-teal-400 mt-0.5">
                    {distKm != null ? `${distKm} km` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Tiempo de llegada</div>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                    {etaMin != null ? `${etaMin} min` : "—"}
                  </div>
                </div>
                {distKm == null && (
                  <div className="col-span-2 text-[10px] text-slate-500 italic">
                    Selecciona una estación con coordenadas e ingresa la posición del bus.
                  </div>
                )}
                {distKm != null && etaMin == null && (
                  <div className="col-span-2 text-[10px] text-amber-400 italic">
                    Ingresa una velocidad mayor a 0 para estimar el tiempo.
                  </div>
                )}
              </div>

              {etaSaveMsg && (
                <div className="text-xs text-slate-300 bg-slate-800/50 p-2.5 rounded-lg border border-slate-800">
                  {etaSaveMsg}
                </div>
              )}

              <div className="flex gap-2 justify-end mt-1">
                <button
                  onClick={() => setEtaBus(null)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleSaveEta}
                  disabled={etaSaving || etaMin == null || !dest}
                  className="px-3 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-lg text-white transition-colors cursor-pointer"
                >
                  {etaSaving ? "Guardando..." : "Guardar ETA"}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
