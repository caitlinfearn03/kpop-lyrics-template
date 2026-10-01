/* ==========================================================================
   Master JavaScript File - Chord & Lyrics Renderer
   ========================================================================== */

if (typeof window.songData === 'undefined') {
  window.songData = "";
}

let currentFontScale = 1.0;
let isScrolling = false;
let scrollSpeed = 0;
let scrollAnimationFrame = null;
let lastScrollTimestamp = null;
let currentScrollY = 0;
let transposeSteps = 0;
let activeMemberFilter = null;

function initApp() {
  if (typeof songData !== 'undefined' && songData) {
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

function getVisualLength(str) {
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0x2E80) len += 2; // CJK & Korean character weight
    else len += 1;
  }
  return len;
}

function processInlineChords(text) {
  if (!text) return "";
  
  let trailingExtra = "";
  const trailingMatch = text.match(/(\s*[\(\[\{]?\s*x\d+\s*[\)\]\}]?\s*)$/i);
  if (trailingMatch && !text.endsWith(']')) {
    trailingExtra = trailingMatch[1];
    text = text.substring(0, text.length - trailingMatch[1].length);
  }

  // Convert underscore spacing placeholders directly to Unicode non-breaking spaces
  let processed = text.replace(/_/g, '\u00A0');

  if (!text.includes('[')) {
    return `<span class="lyric-text">${processed}</span>${trailingExtra ? `<span class="trailing-extra">${trailingExtra}</span>` : ''}`;
  }

  let result = '<span class="chord-line-wrapper">';
  const tokens = processed.split(/(\[[^\]]+\])/);

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    if (!token) continue;

    if (token.startsWith('[') && token.endsWith(']')) {
      const chord = token.slice(1, -1);
      const currentChord = transposeChordName(chord, transposeSteps);
      
      let fullNextToken = tokens[i + 1] || "";
      let chordText = "";

      // If the chord is placed directly on an underscore placeholder space
      if (fullNextToken.startsWith('\u00A0')) {
        chordText = '\u00A0';
        tokens[i + 1] = fullNextToken.substring(1);
      } else {
        const match = fullNextToken.match(/^(\s*\S+)([\s\S]*)$/);
        if (match) {
          chordText = match[1];
          tokens[i + 1] = match[2];
        } else {
          chordText = fullNextToken;
          tokens[i + 1] = "";
        }
      }

      let visualTextLen = getVisualLength(chordText);
      let chordLen = currentChord.length + 0.5;

      let marginStyle = "";
      if (chordLen > visualTextLen) {
        let diff = (chordLen - visualTextLen).toFixed(2);
        marginStyle = ` style="margin-right: ${diff}ch;"`;
      }

      let formattedText = chordText;
      if (chordText.length > 0) {
        const firstVisibleMatch = chordText.match(/^(\s*)(\S)/);
        if (firstVisibleMatch) {
          const before = firstVisibleMatch[1];
          const char = firstVisibleMatch[2];
          const after = chordText.substring(firstVisibleMatch[0].length);
          formattedText = `${before}<span class="chord-highlight">${char}</span>${after}`;
        }
      }

      result += `<span class="chord-segment"${marginStyle}><span class="inline-chord" data-original-chord="${chord}">${currentChord}</span><span class="lyric-text">${formattedText}</span></span>`;
    } else {
      result += `<span class="lyric-text">${token}</span>`;
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
      keyItem.onclick = function() { toggleMemberFilter(emoji); };
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
        <div class="content-col">
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
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
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
  const memberOn = document.getElementById('showMember') ? document.getElementById('showMember').checked : true;
  const chordsOn = document.getElementById('showChords') ? document.getElementById('showChords').checked : true;
  const hangulOn = document.getElementById('showHangul') ? document.getElementById('showHangul').checked : true;
  const romanOn = document.getElementById('showRoman') ? document.getElementById('showRoman').checked : true;
  const englishOn = document.getElementById('showEnglish') ? document.getElementById('showEnglish').checked : true;

  document.body.classList.toggle('chords-disabled', !chordsOn);

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

    if (hangulEl) { hangulEl.classList.toggle('hidden', !hangulOn); hangulEl.classList.remove('primary-lyric'); }
    if (romanEl) { romanEl.classList.toggle('hidden', !romanOn); romanEl.classList.remove('primary-lyric'); }
    if (englishEl) { englishEl.classList.toggle('hidden', !englishOn); englishEl.classList.remove('primary-lyric'); }

    const visibleLines = [hangulEl, romanEl, englishEl].filter(el => el && !el.classList.contains('hidden'));
    if (visibleLines.length > 0) {
      visibleLines[0].classList.add('primary-lyric');
    }

    let chordRowAssigned = false;
    visibleLines.forEach(el => {
      const inlineChords = el.querySelectorAll('.inline-chord');
      if (chordsOn && !chordRowAssigned && inlineChords.length > 0) {
        inlineChords.forEach(c => c.classList.remove('hidden'));
        chordRowAssigned = true;
      } else {
        inlineChords.forEach(c => c.classList.add('hidden'));
      }
    });

    const blockVisibleLines = block.querySelectorAll('.lyric-line:not(.hidden)');
    block.classList.toggle('hidden', blockVisibleLines.length === 0);

    const firstVisibleLine = block.querySelector('.lyric-line:not(.hidden)');
    const hasChordsOnTop = firstVisibleLine && chordsOn && firstVisibleLine.querySelectorAll('.inline-chord:not(.hidden)').length > 0;
    block.classList.toggle('has-top-chords', Boolean(hasChordsOnTop));
  });

  updateMemberColumn(memberOn);
}
