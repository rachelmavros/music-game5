import React, { useState, useRef, useCallback, useEffect } from "react";

const DURATIONS = [1, 2, 4, 7, 11, 16];
const MAX_GUESSES = 6;

// Curated list of popular songs used to pick the daily challenge
const SONG_SEARCHES = [
  "Bohemian Rhapsody Queen", "Blinding Lights Weeknd", "Shape of You Ed Sheeran",
  "Rolling in the Deep Adele", "Uptown Funk Bruno Mars", "Bad Guy Billie Eilish",
  "Someone Like You Adele", "Happy Pharrell Williams", "Lose Yourself Eminem",
  "Smells Like Teen Spirit Nirvana", "Hotel California Eagles", "Billie Jean Michael Jackson",
  "Thriller Michael Jackson", "Purple Rain Prince", "Don't Stop Believin Journey",
  "Eye of the Tiger Survivor", "Africa Toto", "Take On Me a-ha",
  "Dancing Queen ABBA", "Mr Brightside Killers", "Seven Nation Army White Stripes",
  "Crazy in Love Beyonce", "Umbrella Rihanna", "Poker Face Lady Gaga",
  "Call Me Maybe Carly Rae Jepsen", "Get Lucky Daft Punk", "Stay With Me Sam Smith",
  "Despacito Luis Fonsi", "God's Plan Drake", "Shallow Lady Gaga",
  "drivers license Olivia Rodrigo", "As It Was Harry Styles", "Anti-Hero Taylor Swift",
  "Flowers Miley Cyrus", "Levitating Dua Lipa", "Watermelon Sugar Harry Styles",
  "Dynamite BTS", "Peaches Justin Bieber", "good 4 u Olivia Rodrigo",
  "Industry Baby Lil Nas X", "Heat Waves Glass Animals", "Stay Kid Laroi",
  "Happier Marshmello", "Rockstar Post Malone", "Sunflower Post Malone",
  "Old Town Road Lil Nas X", "Without Me Eminem", "Lose Control Teddy Swims",
  "Espresso Sabrina Carpenter", "Paint The Town Red Doja Cat",
];

async function fetchITunes(term, limit = 8) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=${limit}&media=music`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.results || []).filter(t => t.previewUrl);
}

function Waveform({ clipDuration, progress, playing }) {
  const bars = 70;
  const unlocked = Math.round((clipDuration / 16) * bars);
  const playedBars = playing ? Math.round(progress * unlocked) : 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 3, height: 56,
      background: "var(--color-background-secondary)",
      borderRadius: "var(--border-radius-md)", padding: "0 14px",
      marginBottom: 6, overflow: "hidden"
    }}>
      {Array.from({ length: bars }, (_, i) => {
        const h = 8 + Math.abs(Math.sin(i * 0.65) * 10 + Math.sin(i * 1.35) * 12 + Math.sin(i * 0.28) * 7);
        const isUnlocked = i < unlocked;
        const isPlayed = i < playedBars;
        return (
          <div key={i} style={{
            width: 4, flexShrink: 0, borderRadius: 2,
            height: Math.min(46, Math.max(6, h)),
            background: isPlayed ? "#534AB7" : isUnlocked ? "#7F77DD" : "var(--color-border-tertiary)",
            opacity: isUnlocked ? 1 : 0.4,
            transition: "background 0.05s",
          }} />
        );
      })}
    </div>
  );
}

function GuessSlot({ index, guess }) {
  const nextDur = DURATIONS[Math.min(index + 1, DURATIONS.length - 1)];
  const curDur = DURATIONS[Math.min(index, DURATIONS.length - 1)];
  const bonus = nextDur - curDur;
  const base = {
    display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
    borderRadius: "var(--border-radius-md)", fontSize: 14,
    border: "0.5px dashed var(--color-border-tertiary)",
  };
  if (!guess) return (
    <div style={{ ...base, color: "var(--color-text-tertiary)" }}>
      <span style={{ opacity: 0.35, width: 18, textAlign: "center", fontSize: 12 }}>{index + 1}</span>
      <span>Guess {index + 1}</span>
      {index > 0 && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-tertiary)" }}>+{bonus}s on wrong/skip</span>}
    </div>
  );
  if (guess.correct) return (
    <div style={{ ...base, borderStyle: "solid", borderColor: "#1D9E75", background: "#E1F5EE", color: "#085041" }}>
      <span style={{ color: "#1D9E75" }}>✓</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontWeight: 500 }}>{guess.trackName}</span>
        <span style={{ fontSize: 12, opacity: 0.8 }}>{guess.artistName}</span>
      </div>
    </div>
  );
  if (guess.skipped) return (
    <div style={{ ...base, borderStyle: "solid", background: "var(--color-background-secondary)", color: "var(--color-text-tertiary)" }}>
      <span>⟶</span>
      <span style={{ fontStyle: "italic" }}>Skipped</span>
      <span style={{ marginLeft: "auto", fontSize: 12 }}>+{bonus}s unlocked</span>
    </div>
  );
  return (
    <div style={{ ...base, borderStyle: "solid", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }}>
      <span style={{ color: "#E24B4A" }}>✕</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span>{guess.trackName}</span>
        <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{guess.artistName}</span>
      </div>
      <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>+{bonus}s unlocked</span>
    </div>
  );
}

export default function MusicGame() {
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [guesses, setGuesses] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [clipDur, setClipDur] = useState(DURATIONS[0]);
  const [selected, setSelected] = useState(null);
  const [searchVal, setSearchVal] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [ddOpen, setDdOpen] = useState(false);
  const [ddLoading, setDdLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [focusIdx, setFocusIdx] = useState(-1);

  const audioRef = useRef(null);
  const acTimerRef = useRef(null);
  const progressTimerRef = useRef(null);

  const loadNewSong = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSong(null);
    stopAudio();

    const query = SONG_SEARCHES[Math.floor(Math.random() * SONG_SEARCHES.length)];
    try {
      const results = await fetchITunes(query, 5);
      if (!results.length) throw new Error("No preview available");
      // Pick the best match (first result usually most relevant)
      const track = results[0];
      setSong(track);
      setGuesses([]);
      setGameOver(false);
      setClipDur(DURATIONS[0]);
      setSelected(null);
      setSearchVal("");
      setSuggestions([]);
      setDdOpen(false);
      setProgress(0);
    } catch (e) {
      setLoadError("Couldn't load a song — " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNewSong(); }, []);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
    setPlaying(false);
    setProgress(0);
  }

  function playClip() {
    if (playing) { stopAudio(); return; }
    if (!song?.previewUrl) return;

    stopAudio();

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.src = song.previewUrl;
    audioRef.current = audio;

    audio.addEventListener("canplay", () => {
      audio.play().catch(() => {});
      setPlaying(true);

      progressTimerRef.current = setInterval(() => {
        const pct = audio.currentTime / clipDur;
        setProgress(Math.min(1, pct));
        if (audio.currentTime >= clipDur) {
          audio.pause();
          clearInterval(progressTimerRef.current);
          setPlaying(false);
          setProgress(0);
        }
      }, 50);
    });

    audio.load();
  }

  async function fetchSuggestions(q) {
    setDdLoading(true);
    setDdOpen(true);
    try {
      const results = await fetchITunes(q, 8);
      setSuggestions(results);
      setDdOpen(results.length > 0);
    } catch (e) {
      setSuggestions([]);
    } finally {
      setDdLoading(false);
    }
  }

  function onSearchChange(e) {
    const v = e.target.value;
    setSearchVal(v);
    setSelected(null);
    clearTimeout(acTimerRef.current);
    if (v.length < 2) { setDdOpen(false); setSuggestions([]); return; }
    acTimerRef.current = setTimeout(() => fetchSuggestions(v), 350);
  }

  function pickItem(item) {
    setSelected(item);
    setSearchVal(item.trackName + " — " + item.artistName);
    setDdOpen(false);
    setFocusIdx(-1);
  }

  function submitGuess() {
    if (!selected || gameOver) return;
    const correct = selected.trackId === song.trackId;
    const newGuess = { ...selected, correct, skipped: false };
    const newGuesses = [...guesses, newGuess];
    setGuesses(newGuesses);
    stopAudio();

    if (correct) {
      setGameOver(true);
    } else {
      const nextDur = DURATIONS[Math.min(newGuesses.length, DURATIONS.length - 1)];
      setClipDur(nextDur);
      setSelected(null);
      setSearchVal("");
      if (newGuesses.length >= MAX_GUESSES) setGameOver(true);
    }
  }

  function skipGuess() {
    if (gameOver) return;
    const newGuesses = [...guesses, { skipped: true, correct: false }];
    setGuesses(newGuesses);
    stopAudio();
    const nextDur = DURATIONS[Math.min(newGuesses.length, DURATIONS.length - 1)];
    setClipDur(nextDur);
    setSelected(null);
    setSearchVal("");
    if (newGuesses.length >= MAX_GUESSES) setGameOver(true);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && focusIdx >= 0 && suggestions[focusIdx]) { pickItem(suggestions[focusIdx]); }
    else if (e.key === "Escape") { setDdOpen(false); }
  }

  const won = gameOver && guesses.some(g => g.correct);
  const guessCount = guesses.filter(g => !g.skipped).length;
  const winMsgs = ["Incredible — first try!", "Amazing!", "Nice work!", "Not bad!", "You scraped by!", "Just in time!"];

  const btn = (primary, disabled) => ({
    height: 40, padding: "0 16px", borderRadius: "var(--border-radius-md)",
    border: primary ? "0.5px solid #534AB7" : "0.5px solid var(--color-border-secondary)",
    background: primary ? "#7F77DD" : "var(--color-background-primary)",
    color: primary ? "white" : "var(--color-text-secondary)",
    fontSize: 14, cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1, whiteSpace: "nowrap", fontFamily: "var(--font-sans)",
  });

  if (loading) return (
    <div style={{ padding: "3rem 0", textAlign: "center", color: "var(--color-text-secondary)", fontSize: 14 }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🎵</div>
      Loading your song from iTunes...
    </div>
  );

  if (loadError) return (
    <div style={{ padding: "3rem 0", textAlign: "center" }}>
      <div style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 12 }}>{loadError}</div>
      <button onClick={loadNewSong} style={btn(true, false)}>Try again</button>
    </div>
  );

  return (
    <div style={{ padding: "1.5rem 0", maxWidth: 580, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>🎵 Guess the song</h1>
      <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
        Play the clip · search for the song · click to select · hit Guess
      </p>

      {gameOver && song && (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: 12 }}>
          {song.artworkUrl100 && <img src={song.artworkUrl100} alt="" style={{ width: 52, height: 52, borderRadius: "var(--border-radius-md)", flexShrink: 0 }} />}
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>{song.trackName}</div>
            <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 2 }}>{song.artistName} · {song.collectionName}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 2 }}>{new Date(song.releaseDate).getFullYear()}</div>
          </div>
        </div>
      )}

      <Waveform clipDuration={clipDur} progress={progress} playing={playing} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-secondary)", marginBottom: "1.25rem" }}>
        <span>Unlocked: {clipDur}s</span><span>of 16s</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
        <button onClick={playClip} style={{ width: 46, height: 46, borderRadius: "50%", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {playing ? "⏸" : "▶"}
        </button>
        <div style={{ flex: 1, height: 5, background: "var(--color-background-secondary)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", background: "#7F77DD", width: `${progress * 100}%`, borderRadius: 3, transition: "width 0.05s linear" }} />
        </div>
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)", minWidth: 36, textAlign: "right" }}>
          {(progress * clipDur).toFixed(1)}s
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {Array.from({ length: MAX_GUESSES }, (_, i) => (
          <GuessSlot key={i} index={i} guess={guesses[i]} />
        ))}
      </div>

      {!gameOver && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              value={searchVal}
              onChange={onSearchChange}
              onKeyDown={onKeyDown}
              onBlur={() => setTimeout(() => setDdOpen(false), 180)}
              onFocus={() => suggestions.length > 0 && setDdOpen(true)}
              placeholder="Search for a song or artist..."
              autoComplete="off"
              style={{
                width: "100%", height: 40, padding: "0 12px",
                borderRadius: "var(--border-radius-md)",
                border: selected ? "0.5px solid #7F77DD" : "0.5px solid var(--color-border-secondary)",
                background: selected ? "#EEEDFE" : "var(--color-background-primary)",
                color: selected ? "#3C3489" : "var(--color-text-primary)",
                fontSize: 14, fontFamily: "var(--font-sans)",
                fontWeight: selected ? 500 : 400,
              }}
            />
            {ddOpen && (
              <div style={{ position: "absolute", top: 44, left: 0, right: 0, background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", zIndex: 50, maxHeight: 260, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
                {ddLoading && <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--color-text-secondary)" }}>Searching iTunes…</div>}
                {!ddLoading && suggestions.length === 0 && <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--color-text-secondary)" }}>No results found</div>}
                {!ddLoading && suggestions.map((item, i) => (
                  <div key={item.trackId} onMouseDown={e => { e.preventDefault(); pickItem(item); }}
                    style={{
                      padding: "10px 14px", fontSize: 13, cursor: "pointer",
                      borderTop: i > 0 ? "0.5px solid var(--color-border-tertiary)" : "none",
                      background: i === focusIdx ? "#EEEDFE" : "transparent",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                    {item.artworkUrl60 && <img src={item.artworkUrl60.replace("60x60", "40x40")} alt="" style={{ width: 36, height: 36, borderRadius: 4, flexShrink: 0 }} />}
                    <div>
                      <div style={{ color: i === focusIdx ? "#3C3489" : "var(--color-text-primary)", fontWeight: 500 }}>{item.trackName}</div>
                      <div style={{ fontSize: 12, color: i === focusIdx ? "#7F77DD" : "var(--color-text-secondary)", marginTop: 1 }}>{item.artistName} · {item.collectionName}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={submitGuess} disabled={!selected} style={btn(true, !selected)}>Guess</button>
          <button onClick={skipGuess} style={btn(false, false)}>Skip</button>
        </div>
      )}

      {gameOver && (
        <div style={{ marginTop: 16, borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", ...(won ? { background: "#E1F5EE", border: "0.5px solid #1D9E75" } : { background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)" }) }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: won ? "#085041" : "var(--color-text-primary)", marginBottom: 4 }}>
            {won ? `🎉 Got it in ${guessCount} guess${guessCount !== 1 ? "es" : ""}!` : "😔 Better luck next time"}
          </div>
          <div style={{ fontSize: 13, color: won ? "#0F6E56" : "var(--color-text-secondary)" }}>
            {won ? winMsgs[guessCount - 1] : "The song is revealed above."}
          </div>
        </div>
      )}

      {gameOver && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={loadNewSong} style={btn(true, false)}>New song →</button>
        </div>
      )}
    </div>
  );
}

