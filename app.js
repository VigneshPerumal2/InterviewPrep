const pages = [
  {
    id: 'start-here',
    title: 'Start Here',
    group: 'Beginner Path',
    file: 'content/00-start-here.md',
    readingTime: 18
  },
  {
    id: 'payments-basics',
    title: 'Visa and Payments Basics',
    group: 'Beginner Path',
    file: 'content/01-visa-payments-basics.md',
    readingTime: 35
  },
  {
    id: 'technical-fundamentals',
    title: 'Technical Fundamentals',
    group: 'Core Knowledge',
    file: 'content/02-technical-fundamentals.md',
    readingTime: 45
  },
  {
    id: 'coding-round',
    title: 'Coding Round',
    group: 'Interview Rounds',
    file: 'content/03-coding-round.md',
    readingTime: 50
  },
  {
    id: 'hld-system-design',
    title: 'HLD System Design',
    group: 'Interview Rounds',
    file: 'content/04-hld-system-design.md',
    readingTime: 60
  },
  {
    id: 'lld-design',
    title: 'LLD Design',
    group: 'Interview Rounds',
    file: 'content/05-lld-design.md',
    readingTime: 55
  },
  {
    id: 'behavioral-hm',
    title: 'Behavioral and Hiring Manager',
    group: 'Interview Rounds',
    file: 'content/06-behavioral-hiring-manager.md',
    readingTime: 40
  },
  {
    id: 'seven-day-plan',
    title: '7-Day Study Plan',
    group: 'Practice Plan',
    file: 'content/07-seven-day-plan.md',
    readingTime: 18
  },
  {
    id: 'sources',
    title: 'Research Sources',
    group: 'Reference',
    file: 'content/08-sources.md',
    readingTime: 10
  }
];

const STORAGE_KEY = 'visaPrepProgress';
const SCROLL_KEY = 'visaPrepScrollPositions';

let currentPage = null;
let progress = {
  completedPages: {},
  lastStudyDate: null,
  streak: 0
};
let scrollPositions = {};
let scrollSaveTimeout = null;
let currentQuiz = null;

marked.setOptions({ breaks: true, gfm: true });

document.addEventListener('DOMContentLoaded', () => {
  initializeMermaid();
  loadProgress();
  renderNavigation();
  setupEvents();
  updateProgressUI();

  const initialPage = window.location.hash.replace('#', '') || 'start-here';
  loadPage(initialPage);
});

function initializeMermaid() {
  if (!window.mermaid) return;
  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    themeVariables: {
      background: '#f8fafc',
      primaryColor: '#eef4ff',
      primaryTextColor: '#172554',
      primaryBorderColor: '#3354d1',
      lineColor: '#475569',
      secondaryColor: '#fff7ed',
      tertiaryColor: '#f1f5f9',
      fontFamily: 'Inter, sans-serif'
    },
    flowchart: { curve: 'basis' }
  });
}

function setupEvents() {
  document.getElementById('search-input').addEventListener('input', event => {
    filterNavigation(event.target.value);
  });

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  window.addEventListener('hashchange', () => {
    const pageId = window.location.hash.replace('#', '');
    if (pageId && pageId !== currentPage?.id) loadPage(pageId);
  });

  document.getElementById('quiz-button').addEventListener('click', openQuiz);
  document.getElementById('quiz-close').addEventListener('click', closeQuiz);
  document.getElementById('quiz-close-scrim').addEventListener('click', closeQuiz);
  document.getElementById('quiz-next').addEventListener('click', renderQuizQuestion);
  document.getElementById('quiz-show-answer').addEventListener('click', revealQuizAnswer);
}

function loadProgress() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) progress = JSON.parse(saved);

  const savedScroll = localStorage.getItem(SCROLL_KEY);
  if (savedScroll) scrollPositions = JSON.parse(savedScroll);

  updateStreak();
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function updateStreak() {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (progress.lastStudyDate === today) return;
  progress.streak = progress.lastStudyDate === yesterday ? progress.streak + 1 : 1;
  progress.lastStudyDate = today;
  saveProgress();
}

function renderNavigation() {
  const navTree = document.getElementById('nav-tree');
  navTree.innerHTML = '';

  const groups = [...new Set(pages.map(page => page.group))];
  groups.forEach(group => {
    const groupPages = pages.filter(page => page.group === group);
    const completed = groupPages.filter(page => progress.completedPages[page.id]).length;

    const heading = document.createElement('div');
    heading.className = 'nav-category';
    heading.textContent = `${group} (${completed}/${groupPages.length})`;
    navTree.appendChild(heading);

    groupPages.forEach(page => navTree.appendChild(createNavItem(page)));
  });
}

function createNavItem(page) {
  const item = document.createElement('a');
  item.className = 'nav-item';
  item.href = `#${page.id}`;
  item.dataset.id = page.id;

  if (progress.completedPages[page.id]) item.classList.add('completed');

  const checkbox = document.createElement('span');
  checkbox.className = 'nav-checkbox';
  checkbox.textContent = progress.completedPages[page.id] ? '✓' : '○';
  checkbox.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    toggleComplete(page.id);
  });

  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = page.title;

  item.appendChild(checkbox);
  item.appendChild(title);
  item.addEventListener('click', event => {
    event.preventDefault();
    loadPage(page.id);
  });

  return item;
}

function getPage(pageId) {
  return pages.find(page => page.id === pageId);
}

async function loadPage(pageId) {
  const page = getPage(pageId) || pages[0];
  currentPage = page;
  window.location.hash = page.id;

  document.getElementById('breadcrumb').textContent = `${page.group} / ${page.title}`;
  document.getElementById('focus-display').textContent = `Current page: ${page.title}`;

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.querySelector(`[data-id="${page.id}"]`)?.classList.add('active');

  const content = document.getElementById('markdown-content');
  content.innerHTML = '<div class="loading">Loading...</div>';
  setupScrollTracking(content);

  try {
    const response = await fetch(page.file);
    if (!response.ok) throw new Error(`Could not load ${page.file}`);
    const markdown = await response.text();
    const completed = Boolean(progress.completedPages[page.id]);

    content.innerHTML = `
      <div class="page-header">
        <div>
          <div class="eyebrow">${page.group}</div>
          <h1>${page.title}</h1>
        </div>
        <button class="complete-button" onclick="toggleComplete('${page.id}')">
          ${completed ? 'Completed' : 'Mark Complete'}
        </button>
      </div>
      <div class="page-meta">
        <span>${page.readingTime} min guided read</span>
        <span>Beginner-first explanations</span>
      </div>
      ${marked.parse(markdown)}
    `;

    content.querySelectorAll('pre code:not(.language-mermaid)').forEach(block => {
      hljs.highlightElement(block);
    });

    await renderMermaid(content);
    generateTOC(content);
    content.scrollTop = scrollPositions[page.id] || 0;
  } catch (error) {
    content.innerHTML = `<div class="error"><h2>Page could not load</h2><p>${error.message}</p></div>`;
    clearTOC();
  }
}

function setupScrollTracking(content) {
  if (content.dataset.bound === 'true') return;
  content.addEventListener('scroll', () => {
    if (!currentPage?.id) return;
    clearTimeout(scrollSaveTimeout);
    scrollSaveTimeout = setTimeout(() => {
      scrollPositions[currentPage.id] = content.scrollTop;
      localStorage.setItem(SCROLL_KEY, JSON.stringify(scrollPositions));
    }, 150);
  });
  content.dataset.bound = 'true';
}

async function renderMermaid(container) {
  if (!window.mermaid) return;

  const blocks = Array.from(container.querySelectorAll('pre code.language-mermaid'));
  for (let index = 0; index < blocks.length; index++) {
    const codeBlock = blocks[index];
    const source = codeBlock.textContent.trim();
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid-diagram';

    try {
      const rendered = await window.mermaid.render(`visa-diagram-${Date.now()}-${index}`, source);
      wrapper.innerHTML = rendered.svg;
    } catch (error) {
      wrapper.classList.add('mermaid-error');
      wrapper.textContent = `Diagram error: ${error.message}`;
    }

    codeBlock.closest('pre').replaceWith(wrapper);
  }
}

function generateTOC(content) {
  const toc = document.getElementById('toc-nav');
  const sidebar = document.getElementById('toc-sidebar');
  toc.innerHTML = '';

  const headings = Array.from(content.querySelectorAll('h2, h3'));
  sidebar.style.display = headings.length ? 'block' : 'none';

  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = `section-${index}`;
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.className = `toc-item ${heading.tagName === 'H3' ? 'nested' : ''}`;
    link.textContent = heading.textContent;
    link.addEventListener('click', event => {
      event.preventDefault();
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    toc.appendChild(link);
  });
}

function clearTOC() {
  document.getElementById('toc-nav').innerHTML = '';
  document.getElementById('toc-sidebar').style.display = 'none';
}

function toggleComplete(pageId) {
  if (progress.completedPages[pageId]) {
    delete progress.completedPages[pageId];
  } else {
    progress.completedPages[pageId] = new Date().toISOString();
  }
  progress.lastStudyDate = new Date().toDateString();
  saveProgress();
  renderNavigation();
  updateProgressUI();
  loadPage(pageId);
}

function updateProgressUI() {
  const total = pages.length;
  const completed = Object.keys(progress.completedPages).length;
  const percentage = total ? Math.round((completed / total) * 100) : 0;

  document.getElementById('progress-text').textContent = `${completed}/${total} complete`;
  document.getElementById('streak-text').textContent = `${progress.streak || 0} day streak`;
  document.getElementById('progress-fill').style.width = `${percentage}%`;
}

function filterNavigation(query) {
  const normalized = query.trim().toLowerCase();
  document.querySelectorAll('.nav-item').forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = !normalized || text.includes(normalized) ? 'flex' : 'none';
  });
}

function openQuiz() {
  document.getElementById('quiz-modal').classList.add('open');
  document.getElementById('quiz-modal').setAttribute('aria-hidden', 'false');
  renderQuizQuestion();
}

function closeQuiz() {
  document.getElementById('quiz-modal').classList.remove('open');
  document.getElementById('quiz-modal').setAttribute('aria-hidden', 'true');
}

function renderQuizQuestion() {
  const bank = window.visaQuestionBank || [];
  currentQuiz = bank[Math.floor(Math.random() * bank.length)];
  if (!currentQuiz) return;

  document.getElementById('quiz-meta').textContent = currentQuiz.category;
  document.getElementById('quiz-question').textContent = currentQuiz.question;
  document.getElementById('quiz-explanation').classList.remove('visible');
  document.getElementById('quiz-explanation').textContent = '';

  const options = document.getElementById('quiz-options');
  options.innerHTML = '';
  currentQuiz.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.className = 'quiz-option';
    button.textContent = option;
    button.addEventListener('click', () => selectQuizOption(index, button));
    options.appendChild(button);
  });
}

function selectQuizOption(index, button) {
  document.querySelectorAll('.quiz-option').forEach(option => {
    option.classList.remove('selected', 'correct', 'wrong');
  });

  button.classList.add('selected');
  button.classList.add(index === currentQuiz.answer ? 'correct' : 'wrong');
  revealQuizAnswer();
}

function revealQuizAnswer() {
  if (!currentQuiz) return;
  const explanation = document.getElementById('quiz-explanation');
  explanation.classList.add('visible');
  explanation.textContent = currentQuiz.explanation;

  document.querySelectorAll('.quiz-option').forEach((option, index) => {
    if (index === currentQuiz.answer) option.classList.add('correct');
  });
}

window.toggleComplete = toggleComplete;
