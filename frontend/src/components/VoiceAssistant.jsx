import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const API = 'https://secure-inventory-assistant.onrender.com/api'
const AUTH = { Authorization: 'Bearer owner-demo-token' }

const LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'te-IN', label: 'Telugu + English' },
]

function getRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition
}

function VoiceAssistant({ onInventoryUpdated }) {
  const [language, setLanguage] = useState('en-IN')
  const [isListening, setIsListening] = useState(false)
  const [finalTranscript, setFinalTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [parsedCommand, setParsedCommand] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState('')
  const recognitionRef = useRef(null)
  const stopRequestedRef = useRef(false)
  const recognitionErrorRef = useRef(false)
  const finalTranscriptRef = useRef('')
  const interimTranscriptRef = useRef('')

  const selectedLanguage = LANGUAGES.find((item) => item.code === language)?.label || 'English'
  const displayedTranscript = [finalTranscript, interimTranscript].filter(Boolean).join(' ')

  const sendStockCommand = async (text) => {
    if (!text || isProcessing) return
    setIsProcessing(true)
    setErrorMessage('')
    setParsedCommand(null)
    try {
      const result = await axios.post(`${API}/voice/stock`, { text }, { headers: AUTH })
      setParsedCommand(result.data)
      if (result.data.success && ['ADD', 'REMOVE'].includes(result.data.parsed?.action)) await onInventoryUpdated?.()
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || 'Unable to connect to the inventory server. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const applyEdit = () => {
    finalTranscriptRef.current = editedTranscript.trim()
    setFinalTranscript(editedTranscript.trim())
    setIsEditing(false)
    setParsedCommand(null)
  }

  const stopListening = () => {
    stopRequestedRef.current = true
    recognitionRef.current?.stop()
  }

  const resetVoiceCommand = () => {
    stopRequestedRef.current = true
    recognitionErrorRef.current = false
    recognitionRef.current?.abort()
    recognitionRef.current = null
    finalTranscriptRef.current = ''
    interimTranscriptRef.current = ''
    setIsListening(false)
    setFinalTranscript('')
    setInterimTranscript('')
    setErrorMessage('')
    setParsedCommand(null)
    setIsProcessing(false)
    setIsEditing(false)
    setEditedTranscript('')
  }

  const startListening = () => {
    const Recognition = getRecognitionConstructor()
    if (!Recognition) {
      setErrorMessage('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.')
      return
    }

    if (isListening) {
      stopListening()
      return
    }

    const recognition = new Recognition()
    stopRequestedRef.current = false
    recognitionErrorRef.current = false
    interimTranscriptRef.current = ''
    setInterimTranscript('')
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onstart = () => {
      setErrorMessage('')
      setIsListening(true)
    }
    recognition.onresult = (event) => {
      let nextFinal = ''
      let nextInterim = ''
      for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript.trim()
        if (event.results[index].isFinal) nextFinal += `${text} `
        else nextInterim += `${text} `
      }
      if (nextFinal) {
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${nextFinal}`.trim()
        setFinalTranscript(finalTranscriptRef.current)
      }
      interimTranscriptRef.current = nextInterim.trim()
      setInterimTranscript(interimTranscriptRef.current)
    }
    recognition.onerror = (event) => {
      console.error('[VoiceAssistant] Speech recognition error:', event.error, event.message || '')
      const messages = {
        'not-allowed': 'Microphone permission was denied. Allow microphone access and try again.',
        'audio-capture': 'No microphone was found. Connect a microphone and try again.',
        'no-speech': 'No speech was detected. Try speaking closer to the microphone.',
      }
      setErrorMessage(messages[event.error] || 'Microphone access failed. Please try again.')
      stopRequestedRef.current = true
      recognitionErrorRef.current = true
      setIsListening(false)
    }
    recognition.onnomatch = () => {
      console.error('[VoiceAssistant] Speech recognition returned no match.')
      setErrorMessage('Speech was not recognized. Please try speaking again.')
    }
    recognition.onend = () => {
      if (!finalTranscriptRef.current && interimTranscriptRef.current) {
        finalTranscriptRef.current = interimTranscriptRef.current
        setFinalTranscript(finalTranscriptRef.current)
      }
      const text = finalTranscriptRef.current || interimTranscriptRef.current
      if (!stopRequestedRef.current) setErrorMessage('Speech recognition ended unexpectedly. Click Start Listening to try again.')
      setIsListening(false)
      interimTranscriptRef.current = ''
      setInterimTranscript('')
      recognitionRef.current = null
      if (text && !recognitionErrorRef.current) sendStockCommand(text)
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      console.error('[VoiceAssistant] Unable to start speech recognition.')
      setErrorMessage('Microphone could not be started. Check your browser permissions and try again.')
      setIsListening(false)
      recognitionRef.current = null
    }
  }

  useEffect(() => () => {
    recognitionRef.current?.abort()
  }, [])

  return <section className="assistant-panel" id="overview">
    <div className="assistant-copy">
      <span className="section-kicker">VOICE ASSISTANT <span className={`status-pill ${isListening ? 'is-listening' : ''}`}><i /> {isListening ? 'Listening...' : 'Ready'}</span></span>
      <h2>Speak what changed<br />in your shop.</h2>
      <p>{errorMessage || 'Speak naturally, review the recognized command, and let AI update your inventory.'}</p>
      <div className="voice-details">
        <span>Language: <strong>{selectedLanguage}</strong></span>
        <span>Status: <strong>{isListening ? 'Listening...' : 'Ready'}</strong></span>
      </div>
      {isEditing ? <textarea className="transcript-editor" value={editedTranscript} onChange={(event) => setEditedTranscript(event.target.value)} aria-label="Edit recognized command" /> : <div className="transcript" aria-live="polite">{displayedTranscript || 'Your recognized speech will appear here.'}</div>}
      <button className="parse-command-button" type="button" onClick={() => sendStockCommand(finalTranscript)} disabled={!finalTranscript || isListening || isProcessing}>{isProcessing ? 'Processing...' : 'Process Command'}</button><button className="parse-command-button" type="button" onClick={resetVoiceCommand}>Reset</button>
      {isEditing && <button className="parse-command-button" type="button" onClick={applyEdit} disabled={!editedTranscript.trim()}>Apply Edit</button>}
      {parsedCommand && <div className={`parsed-command ${parsedCommand.success ? '' : 'needs-clarification'}`} aria-live="polite">
        {!parsedCommand.success ? <strong>{parsedCommand.message}</strong> : <><span>Product: <strong>{parsedCommand.parsed.product}</strong></span><span>Action: <strong>{parsedCommand.parsed.action}</strong></span><span>Quantity: <strong>{parsedCommand.parsed.quantity ?? 'Not specified'}</strong></span><span>Unit: <strong>{parsedCommand.parsed.unit ?? 'Not specified'}</strong></span><div className="command-success"><strong>{parsedCommand.message}</strong></div></>}
      </div>}
      {isProcessing && <div className="command-success" aria-live="polite"><strong>Processing your inventory command...</strong></div>}
      <div className="assistant-actions">
        <button className={`mic-button ${isListening ? 'listening' : ''}`} onClick={startListening} aria-label={isListening ? 'Stop listening' : 'Start listening'} title={isListening ? 'Stop Listening' : 'Start Listening'}><span aria-hidden="true">{isListening ? '■' : '●'}</span></button>
        <div><strong>{isListening ? 'Stop Listening' : 'Start Listening'}</strong><small>English, Telugu, Hindi, Telugu + English</small></div>
        <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isListening} aria-label="Speech language">
          {LANGUAGES.map((item) => <option value={item.code} key={item.code}>{item.label}</option>)}
        </select>
      </div>
    </div>
    <div className="assistant-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="voice-wave"><i /><i /><i /><i /><i /></div><span>{isListening ? 'Listening now' : 'Speak naturally'}</span></div>
  </section>
}

export default VoiceAssistant
