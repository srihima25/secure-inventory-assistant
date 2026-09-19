import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

const PARSE_API = 'https://secure-inventory-assistant.onrender.com/api'

const LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'hi-IN', label: 'Hindi' },
]

function getRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition
}

function VoiceAssistant() {
  const [language, setLanguage] = useState('en-IN')
  const [isListening, setIsListening] = useState(false)
  const [finalTranscript, setFinalTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [parsedCommand, setParsedCommand] = useState(null)
  const [isParsing, setIsParsing] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedTranscript, setEditedTranscript] = useState('')
  const recognitionRef = useRef(null)
  const stopRequestedRef = useRef(false)

  const selectedLanguage = LANGUAGES.find((item) => item.code === language)?.label || 'English'
  const displayedTranscript = [finalTranscript, interimTranscript].filter(Boolean).join(' ')

  const understandCommand = async () => {
    if (!finalTranscript || isListening) return
    setIsParsing(true)
    setErrorMessage('')
    setParsedCommand(null)
    setConfirmed(false)
    try {
      const result = await axios.post(`${PARSE_API}/voice/parse`, { text: finalTranscript })
      setParsedCommand(result.data)
    } catch (error) {
      setErrorMessage(error.response?.data?.detail || 'The command could not be understood. Please try again.')
    } finally {
      setIsParsing(false)
    }
  }

  const editCommand = () => {
    setEditedTranscript(finalTranscript)
    setIsEditing(true)
    setConfirmed(false)
  }

  const applyEdit = () => {
    setFinalTranscript(editedTranscript.trim())
    setIsEditing(false)
    setParsedCommand(null)
  }

  const stopListening = () => {
    stopRequestedRef.current = true
    recognitionRef.current?.stop()
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
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = event.results[index][0].transcript.trim()
        if (event.results[index].isFinal) nextFinal += `${text} `
        else nextInterim += `${text} `
      }
      if (nextFinal) setFinalTranscript((current) => `${current} ${nextFinal}`.trim())
      setInterimTranscript(nextInterim.trim())
    }
    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Microphone permission was denied. Allow microphone access and try again.',
        'audio-capture': 'No microphone was found. Connect a microphone and try again.',
        'no-speech': 'No speech was detected. Try speaking closer to the microphone.',
      }
      setErrorMessage(messages[event.error] || 'Microphone access failed. Please try again.')
      stopRequestedRef.current = true
      setIsListening(false)
    }
    recognition.onend = () => {
      if (!stopRequestedRef.current) setErrorMessage('Speech recognition ended unexpectedly. Click Start Listening to try again.')
      setIsListening(false)
      setInterimTranscript('')
      recognitionRef.current = null
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setErrorMessage('Microphone could not be started. Check your browser permissions and try again.')
      setIsListening(false)
      recognitionRef.current = null
    }
  }

  useEffect(() => () => recognitionRef.current?.abort(), [])

  return <section className="assistant-panel" id="overview">
    <div className="assistant-copy">
      <span className="section-kicker">VOICE ASSISTANT <span className={`status-pill ${isListening ? 'is-listening' : ''}`}><i /> {isListening ? 'Listening...' : 'Ready'}</span></span>
      <h2>Speak what changed<br />in your shop.</h2>
      <p>{errorMessage || 'Your speech stays in the browser for now. AI command understanding comes in the next phase.'}</p>
      <div className="voice-details">
        <span>Language: <strong>{selectedLanguage}</strong></span>
        <span>Status: <strong>{isListening ? 'Listening...' : 'Ready'}</strong></span>
      </div>
      {isEditing ? <textarea className="transcript-editor" value={editedTranscript} onChange={(event) => setEditedTranscript(event.target.value)} aria-label="Edit recognized command" /> : <div className="transcript" aria-live="polite">{displayedTranscript || 'Your recognized speech will appear here.'}</div>}
      <button className="parse-command-button" type="button" onClick={understandCommand} disabled={!finalTranscript || isListening || isParsing}>{isParsing ? 'Understanding...' : 'Understand Command'}</button>
      {isEditing && <button className="parse-command-button" type="button" onClick={applyEdit} disabled={!editedTranscript.trim()}>Apply Edit</button>}
      {parsedCommand && !confirmed && <div className={`parsed-command ${parsedCommand.needs_clarification ? 'needs-clarification' : ''}`} aria-live="polite">
        {parsedCommand.needs_clarification ? <strong>{parsedCommand.message}</strong> : <>
          <span>Product: <strong>{parsedCommand.product}</strong></span>
          <span>Action: <strong>{parsedCommand.action}</strong></span>
          <span>Quantity: <strong>{parsedCommand.quantity ?? 'Not specified'}</strong></span>
          <span>Unit: <strong>{parsedCommand.unit ?? 'Not specified'}</strong></span>
          <div className="command-actions"><button type="button" onClick={() => setConfirmed(true)}>Confirm</button><button type="button" onClick={editCommand}>Edit</button><button type="button" onClick={() => setParsedCommand(null)}>Cancel</button></div>
        </>}
      </div>}
      {confirmed && <div className="command-success" aria-live="polite"><strong>Command confirmed in prototype mode.</strong><span>No inventory was changed.</span></div>}
      <div className="assistant-actions">
        <button className={`mic-button ${isListening ? 'listening' : ''}`} onClick={startListening} aria-label={isListening ? 'Stop listening' : 'Start listening'} title={isListening ? 'Stop Listening' : 'Start Listening'}><span aria-hidden="true">{isListening ? '■' : '●'}</span></button>
        <div><strong>{isListening ? 'Stop Listening' : 'Start Listening'}</strong><small>English, Telugu, Hindi</small></div>
        <select value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isListening} aria-label="Speech language">
          {LANGUAGES.map((item) => <option value={item.code} key={item.code}>{item.label}</option>)}
        </select>
      </div>
    </div>
    <div className="assistant-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="voice-wave"><i /><i /><i /><i /><i /></div><span>{isListening ? 'Listening now' : 'Speak naturally'}</span></div>
  </section>
}

export default VoiceAssistant
