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
    id: 'coding-framework',
    title: 'Coding Round',
    group: 'Coding Round',
    file: 'content/coding/00-coding-framework.md',
    readingTime: 18,
    children: [
      { id: 'coding-merge-arrays', title: 'Merge Two Sorted Arrays', file: 'content/coding/merge-two-sorted-arrays.md', readingTime: 30 },
      { id: 'coding-grid-paths', title: 'Grid Paths With Blocked Cells', file: 'content/coding/grid-paths-blocked-cells.md', readingTime: 30 },
      { id: 'coding-stock-profit', title: 'Best Time To Buy And Sell Stock', file: 'content/coding/best-time-buy-sell-stock.md', readingTime: 26 },
      { id: 'coding-first-recurring', title: 'First Recurring Character', file: 'content/coding/first-recurring-character.md', readingTime: 24 },
      { id: 'coding-top-k', title: 'Top K Frequent Elements', file: 'content/coding/top-k-frequent-elements.md', readingTime: 32 },
      { id: 'coding-sliding-window', title: 'Sliding Window Maximum', file: 'content/coding/sliding-window-maximum.md', readingTime: 34 },
      { id: 'coding-lru-cache', title: 'LRU Cache', file: 'content/coding/lru-cache.md', readingTime: 35 },
      { id: 'coding-trie-roots', title: 'Trie Root Word Matching', file: 'content/coding/trie-root-word-matching.md', readingTime: 34 },
      { id: 'coding-valid-parentheses', title: 'Valid Parentheses With Wildcard', file: 'content/coding/valid-parentheses-wildcard.md', readingTime: 34 }
    ]
  },
  {
    id: 'hld-framework',
    title: 'HLD System Design',
    group: 'HLD System Design',
    file: 'content/hld/00-hld-framework.md',
    readingTime: 18,
    children: [
      { id: 'hld-payment-gateway', title: 'Design a Payment Gateway', file: 'content/hld/payment-gateway.md', readingTime: 35 },
      { id: 'hld-million-transactions', title: 'Millions of Transactions System', file: 'content/hld/millions-transactions.md', readingTime: 35 },
      { id: 'hld-fraud-detection', title: 'Real-Time Fraud Detection', file: 'content/hld/fraud-detection.md', readingTime: 35 },
      { id: 'hld-merchant-onboarding', title: 'Merchant Onboarding Platform', file: 'content/hld/merchant-onboarding.md', readingTime: 32 },
      { id: 'hld-rate-limiter', title: 'Payment API Rate Limiter', file: 'content/hld/payment-api-rate-limiter.md', readingTime: 30 },
      { id: 'hld-monitoring-pipeline', title: 'Transaction Monitoring Pipeline', file: 'content/hld/transaction-monitoring-pipeline.md', readingTime: 32 },
      { id: 'hld-notification-service', title: 'Notification and Receipt Service', file: 'content/hld/notification-receipt-service.md', readingTime: 28 },
      { id: 'hld-scale-monolith', title: 'Scale a Monolith to 3x Traffic', file: 'content/hld/scale-monolith.md', readingTime: 30 },
      { id: 'hld-upload-dashboard', title: 'Upload/Download Processing Dashboard', file: 'content/hld/upload-download-dashboard.md', readingTime: 30 }
    ]
  },
  {
    id: 'lld-framework',
    title: 'LLD Design',
    group: 'LLD Design',
    file: 'content/lld/00-lld-framework.md',
    readingTime: 18,
    children: [
      { id: 'lld-idempotency', title: 'Idempotency Key Manager', file: 'content/lld/idempotency-key-manager.md', readingTime: 32 },
      { id: 'lld-payment-auth', title: 'Payment Authorization Workflow', file: 'content/lld/payment-authorization-workflow.md', readingTime: 32 },
      { id: 'lld-retry-processor', title: 'Transaction Retry Processor', file: 'content/lld/transaction-retry-processor.md', readingTime: 28 },
      { id: 'lld-fraud-rules', title: 'Fraud Rule Evaluator', file: 'content/lld/fraud-rule-evaluator.md', readingTime: 30 },
      { id: 'lld-api-rate-limiter', title: 'API Rate Limiter', file: 'content/lld/api-rate-limiter.md', readingTime: 30 },
      { id: 'lld-lru-cache', title: 'LRU Cache', file: 'content/lld/lru-cache.md', readingTime: 30 },
      { id: 'lld-merchant-state', title: 'Merchant Onboarding State Machine', file: 'content/lld/merchant-onboarding-state-machine.md', readingTime: 28 },
      { id: 'lld-audit-writer', title: 'Audit Event Writer', file: 'content/lld/audit-event-writer.md', readingTime: 28 }
    ]
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
const PROBLEM_STATUS_OPTIONS = ['Not Started', 'Learning', 'Practiced', 'Interview Ready'];

let currentPage = null;
let progress = {
  completedPages: {},
  problemStatus: {},
  sectionStatus: {},
  lastOpened: {},
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

  document.getElementById('sidebar-close').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('collapsed');
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
  if (saved) progress = { ...progress, ...JSON.parse(saved) };

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

function flattenPages() {
  return pages.flatMap(page => [page, ...(page.children || []).map(child => ({ ...child, group: page.group, parentId: page.id, parentTitle: page.title }))]);
}

function getPage(pageId) {
  return flattenPages().find(page => page.id === pageId);
}

function getTrackStats(page) {
  const trackPages = [page, ...(page.children || [])];
  const completed = trackPages.filter(item => progress.completedPages[item.id]).length;
  return { completed, total: trackPages.length };
}

function renderNavigation() {
  const navTree = document.getElementById('nav-tree');
  navTree.innerHTML = '';

  const groups = [...new Set(pages.map(page => page.group))];
  groups.forEach(group => {
    const groupPages = pages.filter(page => page.group === group);
    const trackItems = groupPages.flatMap(page => [page, ...(page.children || [])]);
    const completed = trackItems.filter(page => progress.completedPages[page.id]).length;

    const heading = document.createElement('div');
    heading.className = 'nav-category';
    heading.textContent = `${group} (${completed}/${trackItems.length})`;
    navTree.appendChild(heading);

    groupPages.forEach(page => {
      navTree.appendChild(createNavItem(page));
      if (page.children?.length) {
        const childWrap = document.createElement('div');
        childWrap.className = 'nav-children expanded';
        childWrap.id = `children-${page.id}`;
        page.children.forEach(child => childWrap.appendChild(createNavItem({ ...child, group: page.group, parentId: page.id }, true)));
        navTree.appendChild(childWrap);
      }
    });
  });
}

function createNavItem(page, isChild = false) {
  const item = document.createElement('a');
  item.className = `nav-item ${isChild ? 'child' : ''}`;
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

  const status = document.createElement('span');
  status.className = 'nav-status';
  status.textContent = statusShortLabel(progress.problemStatus[page.id]);

  item.appendChild(checkbox);
  item.appendChild(title);
  if (isChild) item.appendChild(status);
  item.addEventListener('click', event => {
    event.preventDefault();
    loadPage(page.id);
    closeSidebarOnMobile();
  });

  return item;
}

function closeSidebarOnMobile() {
  if (window.matchMedia('(max-width: 820px)').matches) {
    document.getElementById('sidebar').classList.remove('collapsed');
  }
}

function statusShortLabel(status) {
  if (status === 'Interview Ready') return 'Ready';
  if (status === 'Practiced') return 'Done';
  if (status === 'Learning') return 'Learn';
  return '';
}

async function loadPage(pageId) {
  const page = getPage(pageId) || pages[0];
  currentPage = page;
  progress.lastOpened[page.id] = new Date().toISOString();
  progress.lastStudyDate = new Date().toDateString();
  saveProgress();
  window.location.hash = page.id;

  document.getElementById('breadcrumb').textContent = `${page.group} / ${page.parentTitle ? `${page.parentTitle} / ` : ''}${page.title}`;
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
        <div class="page-actions">
          ${renderStatusSelect(page.id)}
          <button class="complete-button" onclick="toggleComplete('${page.id}')">
            ${completed ? 'Completed' : 'Mark Complete'}
          </button>
        </div>
      </div>
      <div class="page-meta">
        <span>${page.readingTime} min guided read</span>
        <span>Progress saves in this browser</span>
      </div>
      ${marked.parse(markdown)}
    `;

    content.querySelectorAll('pre code:not(.language-mermaid)').forEach(block => {
      hljs.highlightElement(block);
    });

    await renderMermaid(content);
    injectSectionProgress(content, page.id);
    generateTOC(content);
    content.scrollTop = scrollPositions[page.id] || 0;
  } catch (error) {
    content.innerHTML = `<div class="error"><h2>Page could not load</h2><p>${error.message}</p></div>`;
    clearTOC();
  }
}

function renderStatusSelect(pageId) {
  const value = progress.problemStatus[pageId] || 'Not Started';
  const options = PROBLEM_STATUS_OPTIONS.map(option => `<option value="${option}" ${option === value ? 'selected' : ''}>${option}</option>`).join('');
  return `<label class="status-label">Status <select class="status-select" onchange="setProblemStatus('${pageId}', this.value)">${options}</select></label>`;
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

function injectSectionProgress(content, pageId) {
  const headings = Array.from(content.querySelectorAll('h2'));
  headings.forEach((heading, index) => {
    const sectionKey = `${pageId}:${index}:${heading.textContent}`;
    const checked = Boolean(progress.sectionStatus[sectionKey]);
    const button = document.createElement('button');
    button.className = `section-check ${checked ? 'checked' : ''}`;
    button.type = 'button';
    button.textContent = checked ? '✓' : '○';
    button.title = 'Toggle section progress';
    button.addEventListener('click', () => toggleSection(sectionKey, button));
    heading.prepend(button);
  });
}

function toggleSection(sectionKey, button) {
  if (progress.sectionStatus[sectionKey]) {
    delete progress.sectionStatus[sectionKey];
    button.textContent = '○';
    button.classList.remove('checked');
  } else {
    progress.sectionStatus[sectionKey] = new Date().toISOString();
    button.textContent = '✓';
    button.classList.add('checked');
  }
  saveProgress();
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
    link.textContent = heading.textContent.replace(/^[✓○]\s*/, '');
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
    progress.problemStatus[pageId] = 'Interview Ready';
  }
  progress.lastStudyDate = new Date().toDateString();
  saveProgress();
  renderNavigation();
  updateProgressUI();
  loadPage(pageId);
}

function setProblemStatus(pageId, status) {
  progress.problemStatus[pageId] = status;
  if (status === 'Interview Ready') progress.completedPages[pageId] = new Date().toISOString();
  saveProgress();
  renderNavigation();
  updateProgressUI();
}

function updateProgressUI() {
  const allPages = flattenPages();
  const completed = allPages.filter(page => progress.completedPages[page.id]).length;
  const percentage = allPages.length ? Math.round((completed / allPages.length) * 100) : 0;
  const codingStats = getTrackStats(pages.find(page => page.id === 'coding-framework'));
  const hldStats = getTrackStats(pages.find(page => page.id === 'hld-framework'));
  const lldStats = getTrackStats(pages.find(page => page.id === 'lld-framework'));

  document.getElementById('progress-text').textContent = `${completed}/${allPages.length} complete`;
  document.getElementById('streak-text').textContent = `${progress.streak || 0} day streak`;
  document.getElementById('progress-fill').style.width = `${percentage}%`;
  document.getElementById('focus-display').textContent = `Coding ${codingStats.completed}/${codingStats.total} • HLD ${hldStats.completed}/${hldStats.total} • LLD ${lldStats.completed}/${lldStats.total}`;
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
window.setProblemStatus = setProblemStatus;
