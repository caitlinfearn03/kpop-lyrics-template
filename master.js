let currentFontScale = 1.0;
let isScrolling = false;
let scrollSpeed = 0;
let scrollAnimationFrame = null;
let lastScrollTimestamp = null;
let currentScrollY = 0;
let transposeSteps = 0;
let activeMemberFilter = null;

function initApp() {
  if (typeof songData !== 'undefined') {
    injectLayout();
    buildLyrics();
    updateView();
  } else {
    setTimeout(initApp, 50);
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initApp();
} else {
  document.addEventListener('DOMContentLoaded', initApp);
}

function injectLayout() {
  if (!document.getElementById('headerContainer')) {
    const headerContainer = document.createElement('div');
    headerContainer.id = 'headerContainer';
    document.body.insertBefore(headerContainer, document.body.firstChild);
  }

  if (!document.getElementById('stickyFooter')) {
    const footer = document.createElement('div');
    footer.className = 'sticky-footer-toolbar';
    footer.id = 'stickyFooter';
    footer.innerHTML = `
      <button class="toggle-pill" id="scrollBtn" onclick="toggleAutoScroll()">SCROLL</button>
      <div class="toggle-pill">
        Speed: 
        <button onclick="changeScrollSpeed(-1)">-</button>
        <span id="scrollSpeedLabel">0</span>
        <button onclick="changeScrollSpeed(1)">+</button>
      </div>
    `;
    document.body.appendChild(footer);
  }
}

function changeFontSize(amount) {
  currentFontScale = Math.max(0.6, Math.min(2.0, currentFontScale + amount));
  document.documentElement.style.setProperty('--base-font-scale', currentFontScale);
  const label = document.getElementById('fontSizeLabel');
  if (label) label.textContent = Math.round(currentFontScale * 100) + '%';
}

function toggleAutoScroll() {
  const btn = document.getElementById('scrollBtn');
  if (!btn) return;
  if (isScrolling) {
    if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame);
    scrollAnimationFrame = null;
    lastScrollTimestamp = null;
    btn.textContent = "SCROLL";
    btn.classList.remove('active-stop');
    isScrolling = false;
  } else {
    btn.textContent = "STOP";
    btn.classList.add('active-stop');
    isScrolling = true;
    startScrollEngine();
  }
}

function getPixelsPerSecond(speed) {
  if (speed >= 1) return speed * 30;
  return Math.max(1.5, 20 + (speed * 3.7));
}

function startScrollEngine() {
  if (scrollAnimationFrame) cancelAnimationFrame(scrollAnimationFrame);
  currentScrollY = window.scrollY;

  function scrollStep(timestamp) {
    if (!isScrolling) return;
    if (!lastScrollTimestamp) lastScrollTimestamp = timestamp;
    const deltaTime = (timestamp - lastScrollTimestamp) / 1000;
    lastScrollTimestamp = timestamp;

    if (Math.abs(window.scrollY - currentScrollY) > 8) currentScrollY = window.scrollY;
    const pixelsPerSecond = getPixelsPerSecond(scrollSpeed);
    currentScrollY += pixelsPerSecond * deltaTime;
    window.scrollTo(0, currentScrollY);

    if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 2) {
      toggleAutoScroll();
      return;
    }
    scrollAnimationFrame = requestAnimationFrame(scrollStep);
  }
  lastScrollTimestamp = performance.now();
  scrollAnimationFrame = requestAnimationFrame(scrollStep);
}

function changeScrollSpeed(amount) {
  scrollSpeed = Math.max(-5, Math.min(10, scrollSpeed + amount));
  const label = document.getElementById('scrollSpeedLabel');
  if (label) label.textContent = scrollSpeed;
}

const CHROMATIC_SCALE_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHROMATIC_SCALE_FLATS  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function transposeChordName(chordName, steps) {
  if (steps === 0) return chordName;
  const rootMatch = chordName.match(/^([A-G][b#]?)(.*)/);
  if (!rootMatch) return chordName;
  const root = rootMatch[1];
  const suffix = rootMatch[2];
  let index = CHROMATIC_SCALE_SHARPS.indexOf(root);
  if (index === -1) index = CHROMATIC_SCALE_FLATS.indexOf(root);
  if (index === -1) return chordName;
  let newIndex = (index + steps) % 12;
  if (newIndex < 0) newIndex += 12;
  const useFlats = root.includes('b') || chordName.includes('b');
  const scale = useFlats ? CHROMATIC_SCALE_FLATS : CHROMATIC_SCALE_SHARPS;
  return scale[newIndex] + suffix;
}

function transpose(stepsDelta) {
  transposeSteps += stepsDelta;
  const label = document.getElementById('transposeLabel');
  if (label) label.textContent = (transposeSteps > 0 ? '+' : '') + transposeSteps;
  document.querySelectorAll('.inline-chord').forEach(chordEl => {
    const orig = chordEl.getAttribute('data-original-chord');
    if (orig) chordEl.textContent = transposeChordName(orig, transposeSteps);
  });
}

function isChordOnlyText(str) {
  if (!str) return true;
  const textWithoutChords = str.replace(/\[[^\]]*\]/g, '').trim();
  if (textWithoutChords === '') return true;
  return /^[\(\[\{]?\s*(x\d+\vert{}\d+x\vert{}x\s*\d+\vert{}riff\vert{}repeat\vert{}x2\vert{}x4\vert{}outro\vert{}intro\vert{}solo\vert{}instrumental\vert{}\d+)\s*[\)\]\}]?$/i.test(textWithoutChords);
}

function processInlineChords(text) {
  if (!text) return "";
  
  let trailingExtra = "";
  const trailingMatch = text.match(/(\s*[\(\[\{]?\s*x\d+\s*[\)\]\}]?\s*)$/i);
  if (trailingMatch && !text.endsWith(']')) {
    trailingExtra = trailingMatch[1];
    text = text.substring(0, text.length - trailingMatch[1].length);
  }

  if (!text.includes('[')) {
    return `<span class="lyric-text">${text}</span>${trailingExtra ? `<span class="trailing-extra">${trailingExtra}</span>` : ''}`;
  }
  
  let processed = text.replace(/\[([A-G][b#]?[^\]]*)\](_+)/g, (match, chord, underscores) => {
    return `[${chord}]` + ' '.repeat(underscores.length);
  });
  processed = processed.replace(/_/g, '');
  const parts = processed.split('[');
  let result = '<span class="chord-line-wrapper">';

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    if (i === 0 && part === '') continue;
    if (i === 0 || !part.includes(']')) {
      result += `<span class="chord-segment"><span class="inline-chord empty"></span><span class="lyric-text">${part}</span></span>`;
    } else {
      const splitPart = part.split(']');
      const chord = splitPart[0];
      let lyricText = splitPart.slice(1).join(']');
      const currentChord = transposeChordName(chord, transposeSteps);
      
      if (lyricText.length > 0 && !/^\s/.test(lyricText)) {
        const firstChar = lyricText.charAt(0);
        const restText = lyricText.slice(1);
        lyricText = `<span class="chord-highlight">${firstChar}</span>${restText}`;
      }

      result += `<span class="chord-segment"><span class="inline-chord" data-original-chord="${chord}">${currentChord}</span><span class="lyric-text">${lyricText}</span></span>`;
    }
  }
  
  result += `</span>`;
  
  if (trailingExtra) {
    result += `<span class="trailing-extra">${trailingExtra}</span>`;
  }
  
  return result;
}

function buildLyrics() {
  let headerContainer = document.getElementById('headerContainer');
  let lyricsContainer = document.getElementById('lyricsContainer');
  if (!lyricsContainer) {
    lyricsContainer = document.createElement('div');
    lyricsContainer.id = 'lyricsContainer';
    document.body.insertBefore(lyricsContainer, document.getElementById('stickyFooter'));
  }
  lyricsContainer.innerHTML = '';
  headerContainer.innerHTML = '';

  let keyString = "";
  let currentMember = "";
  let title = "", artist = "";

  const blocks = songData.trim().split(/\n\s*\n/);
  
  blocks.forEach(blockStr => {
    const lines = blockStr.trim().split('\n');
    lines.forEach(l => {
      const line = l.trim();
      if (line.startsWith('Title:')) title = line.replace('Title:', '').trim();
      else if (line.startsWith('Artist:')) artist = line.replace('Artist:', '').trim();
      else if (line.startsWith('Key:') || line.startsWith('K:')) keyString = line.replace(/^(Key:|K:)/, '').trim();
    });
  });

  if (title) {
    const h1 = document.createElement('h1');
    h1.className = 'song-title';
    h1.style.textAlign = 'center';
    h1.textContent = title;
    headerContainer.appendChild(h1);
  }
  if (artist) {
    const h2 = document.createElement('h2');
    h2.className = 'song-artist';
    h2.style.textAlign = 'center';
    h2.textContent = artist;
    headerContainer.appendChild(h2);
  }

  const topPanel = document.createElement('div');
  topPanel.className = 'top-control-panel';

  if (keyString) {
    const keyContainer = document.createElement('div');
    keyContainer.className = 'member-key-container';
    keyContainer.id = 'memberKeyContainer';
    keyString.split(/[\|,;]/).forEach(item => {
      const trimmed = item.trim();
      if (!trimmed) return;
      const parts = trimmed.split('=');
      let emoji = parts.length === 2 ? parts[0].trim() : trimmed.split(/\s/)[0];
      let name = parts.length === 2 ? parts[1].trim() : trimmed.substring(emoji.length).trim();
      
      const keyItem = document.createElement('span');
      keyItem.className = 'member-key-item';
      keyItem.setAttribute('data-emoji', emoji);
      keyItem.onclick = () => toggleMemberFilter(emoji);
      keyItem.innerHTML = `<span class="member-key-emoji">${emoji}</span> ${name}`;
      keyContainer.appendChild(keyItem);
    });
    topPanel.appendChild(keyContainer);
    
    const divider = document.createElement('hr');
    divider.className = 'control-divider';
    topPanel.appendChild(divider);
  }

  const toolbarDiv = document.createElement('div');
  toolbarDiv.className = 'song-toolbar';
  toolbarDiv.innerHTML = `
    <label class="toggle-pill"><input type="checkbox" id="showMember" checked onchange="updateView()"> Member</label>
    <label class="toggle-pill"><input type="checkbox" id="showChords" checked onchange="updateView()"> Chords</label>
    <label class="toggle-pill"><input type="checkbox" id="showHangul" checked onchange="updateView()"> Hangul</label>
    <label class="toggle-pill"><input type="checkbox" id="showRoman" checked onchange="updateView()"> Romanized</label>
    <label class="toggle-pill"><input type="checkbox" id="showEnglish" checked onchange="updateView()"> English</label>
    <div class="toggle-pill">
      Font: 
      <button onclick="changeFontSize(-0.1)">-</button>
      <span id="fontSizeLabel">100%</span>
      <button onclick="changeFontSize(0.1)">+</button>
    </div>
    <div class="toggle-pill" id="transposeWidget">
      Transpose: 
      <button onclick="transpose(-1)">-</button>
      <span id="transposeLabel">0</span>
      <button onclick="transpose(1)">+</button>
    </div>
  `;
  topPanel.appendChild(toolbarDiv);
  headerContainer.appendChild(topPanel);

  blocks.forEach(blockStr => {
    const lines = blockStr.trim().split('\n');
    let section = "", member = "";
    let hangul = "", roman = "", english = "", chordOnly = "";

    lines.forEach(l => {
      const line = l.trim();
      if (line.startsWith('S:')) section = line.replace('S:', '').trim();
      else if (line.startsWith('M:')) member = line.replace('M:', '').trim();
      else if (line.startsWith('C:')) { chordOnly = line.replace('C:', '').trim(); }
      else if (line.startsWith('H:')) { hangul = line.replace('H:', '').trim(); }
      else if (line.startsWith('R:')) { roman = line.replace('R:', '').trim(); }
      else if (line.startsWith('E:')) { english = line.replace('E:', '').trim(); }
      else if (line && !line.includes(':')) {
        if (!hangul) hangul = line;
        else if (!roman) roman = line;
        else if (!english) english = line;
      }
    });

    if (lineIsHeaderOrKey(lines)) return;

    if (section) {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'section-header';
      sectionDiv.textContent = section;
      lyricsContainer.appendChild(sectionDiv);
    }

    if (member) currentMember = member;
    else if (hangul || roman || english || chordOnly) member = currentMember;

    const isChordOnlyBlock = Boolean(chordOnly) || ((hangul || roman || english) && isChordOnlyText(hangul) && isChordOnlyText(roman) && isChordOnlyText(english));

    if (member || hangul || roman || english || chordOnly) {
      const blockDiv = document.createElement('div');
      blockDiv.className = 'line-block';
      if (member) blockDiv.setAttribute('data-member', member);
      if (isChordOnlyBlock) blockDiv.setAttribute('data-chord-only', 'true');

      blockDiv.innerHTML = `
        <div class="member-col"></div>
        <div class="content-col" style="max-width: 100%; overflow-wrap: break-word; word-break: break-word;">
          ${chordOnly ? `<div class="lyric-line chord-only-line">${processInlineChords(chordOnly)}</div>` : ''}
          ${hangul ? `<div class="lyric-line hangul">${processInlineChords(hangul)}</div>` : ''}
          ${roman ? `<div class="lyric-line romanized">${processInlineChords(roman)}</div>` : ''}
          ${english ? `<div class="lyric-line english">${processInlineChords(english)}</div>` : ''}
        </div>
      `;
      lyricsContainer.appendChild(blockDiv);
    }
  });
}

function lineIsHeaderOrKey(lines) {
  for (let l of lines) {
    if (l.startsWith('Title:') || l.startsWith('Artist:') || l.startsWith('Key:') || l.startsWith('K:')) return true;
  }
  return false;
}

function toggleMemberFilter(emoji) {
  activeMemberFilter = (activeMemberFilter === emoji) ? null : emoji;
  document.querySelectorAll('.member-key-item').forEach(item => {
    if (item.getAttribute('data-emoji') === emoji && activeMemberFilter) item.classList.add('active');
    else item.classList.remove('active');
  });
  document.querySelectorAll('.line-block').forEach(block => {
    block.style.opacity = (!activeMemberFilter || block.getAttribute('data-member') === activeMemberFilter) ? '1' : '0.35';
  });
}

function updateMemberColumn(showMember) {
  let lastMemberSeen = null;
  document.querySelectorAll('.line-block').forEach(block => {
    const col = block.querySelector('.member-col');
    if (!col) return;
    const member = block.getAttribute('data-member') || '';
    if (showMember) {
      col.style.display = 'block';
      if (member && member !== lastMemberSeen) {
        col.innerHTML = `<span class="member-prefix">${member}:</span>`;
        lastMemberSeen = member;
      } else {
        col.innerHTML = '';
      }
    } else {
      col.style.display = 'none';
      col.innerHTML = '';
      if (member) lastMemberSeen = member;
    }
  });
}

function updateView() {
  const memberOn = document.getElementById('showMember').checked;
  const chordsOn = document.getElementById('showChords').checked;
  const hangulOn = document.getElementById('showHangul').checked;
  const romanOn = document.getElementById('showRoman').checked;
  const englishOn = document.getElementById('showEnglish').checked;

  const keyContainer = document.getElementById('memberKeyContainer');
  const divider = document.querySelector('.control-divider');
  if (keyContainer) keyContainer.classList.toggle('hidden', !memberOn);
  if (divider) divider.classList.toggle('hidden', !memberOn);

  document.querySelectorAll('.line-block').forEach(block => {
    const isChordOnly = block.getAttribute('data-chord-only') === 'true';
    if (isChordOnly) {
      block.classList.toggle('hidden', !chordsOn);
      return;
    }
    
    const hangulEl = block.querySelector('.hangul');
    const romanEl = block.querySelector('.romanized');
    const englishEl = block.querySelector('.english');

    if (hangulEl) hangulEl.classList.toggle('hidden', !hangulOn);
    if (romanEl) romanEl.classList.toggle('hidden', !romanOn);
    if (englishEl) englishEl.classList.toggle('hidden', !englishOn);

    let chordRowAssigned = false;
    [hangulEl, romanEl, englishEl].forEach(el => {
      if (!el || el.classList.contains('hidden')) return;
      const inlineChords = el.querySelectorAll('.inline-chord');
      if (chordsOn && !chordRowAssigned && inlineChords.length > 0) {
        inlineChords.forEach(c => c.classList.remove('hidden'));
        chordRowAssigned = true;
      } else {
        inlineChords.forEach(c => c.classList.add('hidden'));
      }
    });

    const visibleLines = block.querySelectorAll('.lyric-line:not(.hidden)');
    block.classList.toggle('hidden', visibleLines.length === 0);

    // Dynamic check: apply top padding offset to member-col ONLY if top visible line currently has visible chords
    const firstVisibleLine = block.querySelector('.lyric-line:not(.hidden)');
    const hasChordsOnTop = firstVisibleLine && chordsOn && firstVisibleLine.querySelectorAll('.inline-chord:not(.hidden)').length > 0;
    block.classList.toggle('has-top-chords', Boolean(hasChordsOnTop));
  });

  updateMemberColumn(memberOn);
}
