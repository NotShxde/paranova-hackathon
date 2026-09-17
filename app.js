// State
let currentView = 'home-view';
let activeTagFilter = null;
let currentArticle = null;

// SRS State
let srsData = JSON.parse(localStorage.getItem('constitution_srs_data')) || {};
let flashcardSessionPool = []; // For custom tests or standard due cards
let currentFlashcard = null;
let isCustomSession = false;

// Trainer State
let aiApiKey = localStorage.getItem('gemini_api_key') || '';
let currentTrainerTopic = null;
let argumentHistory = JSON.parse(localStorage.getItem('constitution_argument_history')) || [];

let networkGraph = null;

// DOM Elements
const views = {
    home: document.getElementById('home-view'),
    list: document.getElementById('list-view'),
    article: document.getElementById('article-view'),
    caseView: document.getElementById('case-view'),
    flashcards: document.getElementById('flashcards-view'),
    customTest: document.getElementById('custom-test-view'),
    argumentView: document.getElementById('argument-view'),
    analyticsView: document.getElementById('analytics-view')
};

const navBtns = document.querySelectorAll('.nav-btn');
const btnBackList = document.getElementById('btn-back-list');
const btnBackArticle = document.getElementById('btn-back-article');
const btnClearFilter = document.getElementById('btn-clear-filter');

const articleListContainer = document.getElementById('article-list-container');
const filterContainer = document.getElementById('filter-container');
const currentFilterText = document.getElementById('current-filter-text');
const articleContent = document.getElementById('article-content');
const caseContent = document.getElementById('case-content');

const flashcardContainer = document.getElementById('flashcard-container');
const tagsSelectionContainer = document.getElementById('tags-selection-container');
const btnStartCustom = document.getElementById('btn-start-custom');

// Trainer Elements
const apiKeyInput = document.getElementById('gemini-api-key');
const btnSaveKey = document.getElementById('btn-save-key');
const trainerCaseTitle = document.getElementById('trainer-case-title');
const trainerFacts = document.getElementById('trainer-facts');
const trainerIssue = document.getElementById('trainer-issue');
const userArgumentInput = document.getElementById('user-argument-input');
const btnSubmitArgument = document.getElementById('btn-submit-argument');
const aiFeedbackContent = document.getElementById('ai-feedback-content');
const knowledgeGraphContainer = document.getElementById('knowledge-graph');

// Analytics Elements
const btnGenerateAnalytics = document.getElementById('btn-generate-analytics');
const analyticsReportContainer = document.getElementById('analytics-report-container');
const analyticsLoading = document.getElementById('analytics-loading');

// Navigation
function showView(viewName) {
    Object.values(views).forEach(v => {
        v.classList.remove('active');
        // Force reflow for animation
        void v.offsetWidth;
    });

    let viewMap = {
        'home-view': views.home,
        'list-view': views.list,
        'article-view': views.article,
        'case-view': views.caseView,
        'flashcards-view': views.flashcards,
        'custom-test-view': views.customTest,
        'argument-view': views.argumentView,
        'analytics-view': views.analyticsView
    };

    if (viewMap[viewName]) {
        viewMap[viewName].classList.add('active');
    }
    currentView = viewName;

    // Update active state in sidebar
    navBtns.forEach(btn => {
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (viewName === 'home-view') {
        updateDashboard();
    } else if (viewName === 'flashcards-view') {
        startStandardFlashcardSession();
    } else if (viewName === 'list-view') {
        renderArticleList();
    } else if (viewName === 'custom-test-view') {
        renderTagsSelection();
    } else if (viewName === 'argument-view') {
        initArgumentTrainer();
    }
}

navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        showView(e.target.dataset.view);
    });
});

btnBackList.addEventListener('click', () => showView('list-view'));
btnBackArticle.addEventListener('click', () => showView('article-view'));
btnClearFilter.addEventListener('click', () => {
    activeTagFilter = null;
    renderArticleList();
});

// --- Dashboard ---
function updateDashboard() {
    document.getElementById('stat-total-articles').textContent = db.articles.length;

    const now = Date.now();
    let dueCount = 0;

    // Any card that has no data (new) or nextReview < now is due
    db.articles.forEach(article => {
        const data = srsData[article.id];
        if (!data || data.nextReview <= now) {
            dueCount++;
        }
    });

    document.getElementById('stat-due-cards').textContent = dueCount;
}


// --- Directory & Details ---
function renderArticleList() {
    articleListContainer.innerHTML = '';

    let articlesToRender = db.articles;
    if (activeTagFilter) {
        articlesToRender = db.articles.filter(article =>
            (article.concepts && article.concepts.includes(activeTagFilter)) ||
            (article.doctrines && article.doctrines.includes(activeTagFilter))
        );
        filterContainer.style.display = 'block';
        currentFilterText.textContent = `Tag: ${activeTagFilter}`;
    } else {
        filterContainer.style.display = 'none';
    }

    if (articlesToRender.length === 0) {
        articleListContainer.innerHTML = '<p class="text-muted">No articles found.</p>';
        return;
    }

    articlesToRender.forEach(article => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-number">${article.article === "0" ? "Preamble" : `Article ${article.article}`}</div>
            <h3 class="card-title serif">${article.title}</h3>
            <div class="card-excerpt">${article.text}</div>
        `;
        card.addEventListener('click', () => {
            renderArticleDetail(article);
            showView('article-view');
        });
        articleListContainer.appendChild(card);
    });
}

function renderArticleDetail(article) {
    currentArticle = article;
    const isPreamble = article.article === "0";

    let conceptsHtml = '';
    if (article.concepts && article.concepts.length > 0) {
        conceptsHtml = `
            <div class="metadata-section">
                <h3>Concepts</h3>
                <div class="tags-container">
                    ${article.concepts.map(c => `<button class="tag" onclick="filterByTag('${c}')">${c}</button>`).join('')}
                </div>
            </div>
        `;
    }

    let doctrinesHtml = '';
    if (article.doctrines && article.doctrines.length > 0) {
        doctrinesHtml = `
            <div class="metadata-section">
                <h3>Doctrines</h3>
                <div class="tags-container">
                    ${article.doctrines.map(d => `<button class="tag" onclick="filterByTag('${d}')">${d}</button>`).join('')}
                </div>
            </div>
        `;
    }

    let casesHtml = '';
    if (article.cases && article.cases.length > 0) {
        casesHtml = `
            <div class="metadata-section">
                <h3>Related Cases</h3>
                <div>
                    ${article.cases.map(c => `<div class="meta-link" onclick="openCase('${c}')">${c}</div>`).join('')}
                </div>
            </div>
        `;
    }

    let relatedProvisionsHtml = '';
    if (article.related_provisions && article.related_provisions.length > 0) {
        relatedProvisionsHtml = `
            <div class="metadata-section">
                <h3>Related Provisions</h3>
                <div class="tags-container">
                    ${article.related_provisions.map(rp => `<span class="tag">Article ${rp}</span>`).join('')}
                </div>
            </div>
        `;
    }

    articleContent.innerHTML = `
        <div class="detail-header">
            <div class="detail-number">${isPreamble ? 'Preamble' : `Article ${article.article}`}</div>
            <h2 class="detail-title serif text-gold">${article.title}</h2>
        </div>
        <div class="detail-text">
            ${article.text.replace(/\n/g, '<br><br>')}
        </div>
        ${conceptsHtml}
        ${doctrinesHtml}
        ${relatedProvisionsHtml}
        ${casesHtml}
    `;
}

function openCase(caseName) {
    const caseData = db.cases.find(c => c.case_name === caseName);
    if (!caseData) {
        alert("Case details not found in database.");
        return;
    }

    let keywordsHtml = '';
    if (caseData.keywords && caseData.keywords.length > 0) {
        keywordsHtml = caseData.keywords.map(k => `<button class="tag" onclick="filterByTag('${k}')">${k}</button>`).join('');
    }

    let petitionerArgs = caseData.arguments && caseData.arguments.petitioner ? caseData.arguments.petitioner.map(arg => `<li>${arg}</li>`).join('') : '';
    let respondentArgs = caseData.arguments && caseData.arguments.respondent ? caseData.arguments.respondent.map(arg => `<li>${arg}</li>`).join('') : '';

    caseContent.innerHTML = `
        <div class="detail-header">
            <div class="detail-number">${caseData.year} | ${caseData.court}</div>
            <h2 class="detail-title serif text-gold">${caseData.case_name}</h2>
        </div>
        <div class="case-grid">
            <div class="case-card"><h4>Issue</h4><p>${caseData.issue}</p></div>
            <div class="case-card"><h4>Holding</h4><p>${caseData.holding}</p></div>
            <div class="case-card" style="grid-column: 1 / -1;"><h4>Facts</h4><p>${caseData.facts}</p></div>
            <div class="case-card"><h4>Petitioner Arguments</h4><ul>${petitionerArgs}</ul></div>
            <div class="case-card"><h4>Respondent Arguments</h4><ul>${respondentArgs}</ul></div>
            <div class="case-card" style="grid-column: 1 / -1;">
                <h4>Keywords & Doctrines</h4>
                <div class="tags-container" style="margin-top: 10px;">${keywordsHtml}</div>
            </div>
        </div>
    `;
    showView('case-view');
}

window.filterByTag = function (tag) {
    activeTagFilter = tag;
    renderArticleList();
    showView('list-view');
};

// --- SRS (Anki Style) Logic ---

// SM-2 Algorithm Implementation
// Ratings: 0 = Again (Failed), 1 = Hard (Pass), 2 = Good (Pass), 3 = Easy (Pass)
function calculateSM2(rating, prevData) {
    let ease = prevData ? prevData.ease : 2.5;
    let interval = prevData ? prevData.interval : 0; // interval in days
    let repetitions = prevData ? prevData.repetitions : 0;

    if (rating === 0) {
        // Again
        repetitions = 0;
        interval = 1 / (24 * 60); // 1 minute in days
        ease = Math.max(1.3, ease - 0.20);
    } else {
        // Passed
        if (repetitions === 0) {
            interval = 1;
        } else if (repetitions === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * ease);
        }

        if (rating === 1) { // Hard
            interval = Math.max(1, interval * 0.5); // tweak SM2 slightly for "Hard"
            ease = Math.max(1.3, ease - 0.15);
        } else if (rating === 2) { // Good
            // standard progression
        } else if (rating === 3) { // Easy
            interval = Math.round(interval * 1.3);
            ease += 0.15;
        }
        repetitions += 1;
    }

    return {
        interval: interval,
        ease: ease,
        repetitions: repetitions,
        nextReview: Date.now() + (interval * 24 * 60 * 60 * 1000)
    };
}

function startStandardFlashcardSession() {
    isCustomSession = false;
    const now = Date.now();

    // Pool only due cards
    flashcardSessionPool = db.articles.filter(article => {
        const data = srsData[article.id];
        return !data || data.nextReview <= now;
    });

    // If no cards are due, put all cards in pool just to allow studying
    if (flashcardSessionPool.length === 0) {
        flashcardSessionPool = [...db.articles];
    }

    // Shuffle
    flashcardSessionPool.sort(() => 0.5 - Math.random());
    generateNextFlashcard();
}

function generateNextFlashcard() {
    if (flashcardSessionPool.length === 0) {
        if (isCustomSession) {
            flashcardContainer.innerHTML = `<div class="flashcard"><h3 class="flashcard-question">Custom training complete!</h3></div>`;
        } else {
            flashcardContainer.innerHTML = `<div class="flashcard"><h3 class="flashcard-question">You've reviewed all due cards!</h3></div>`;
        }
        updateDashboard();
        return;
    }

    currentFlashcard = flashcardSessionPool.pop();

    // Question format: either "What does Article X state?" or "Which Article covers [Topic]?"
    const askTitle = Math.random() > 0.5;

    let question = "";
    let answer = "";

    if (askTitle) {
        const ref = currentFlashcard.article === "0" ? "The Preamble" : `Article ${currentFlashcard.article}`;
        question = `What is <span class="text-gold">${ref}</span> about?`;
        answer = `<strong>Title:</strong> ${currentFlashcard.title}<br><br><span class="text-muted">Excerpt: ${currentFlashcard.text.substring(0, 150)}...</span>`;
    } else {
        question = `Which article deals with:<br><span class="text-gold">"${currentFlashcard.title}"</span>?`;
        answer = `<strong>Answer:</strong> ${currentFlashcard.article === "0" ? "The Preamble" : `Article ${currentFlashcard.article}`}`;
    }

    flashcardContainer.innerHTML = `
        <div class="flashcard">
            <h3 class="flashcard-question">${question}</h3>
            
            <button id="btn-reveal-answer" class="btn btn-primary">Reveal Answer</button>
            
            <div id="flashcard-answer" class="flashcard-answer">
                ${answer}
            </div>
            
            <div id="mastery-buttons" class="mastery-buttons">
                <button class="mastery-btn again" data-rating="0">
                    <span>Again</span>
                    <span class="interval">< 1m</span>
                </button>
                <button class="mastery-btn hard" data-rating="1">
                    <span>Hard</span>
                    <span class="interval" id="int-hard"></span>
                </button>
                <button class="mastery-btn good" data-rating="2">
                    <span>Good</span>
                    <span class="interval" id="int-good"></span>
                </button>
                <button class="mastery-btn easy" data-rating="3">
                    <span>Easy</span>
                    <span class="interval" id="int-easy"></span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('btn-reveal-answer').addEventListener('click', (e) => {
        e.target.style.display = 'none';
        document.getElementById('flashcard-answer').style.display = 'block';
        document.getElementById('mastery-buttons').style.display = 'grid';

        // Calculate potential intervals for UI display
        const prevData = srsData[currentFlashcard.id];

        const formatInterval = (days) => {
            if (days < 1) return '< 1d';
            if (days < 30) return Math.round(days) + 'd';
            return Math.round(days / 30) + 'mo';
        };

        document.getElementById('int-hard').textContent = formatInterval(calculateSM2(1, prevData).interval);
        document.getElementById('int-good').textContent = formatInterval(calculateSM2(2, prevData).interval);
        document.getElementById('int-easy').textContent = formatInterval(calculateSM2(3, prevData).interval);
    });

    document.querySelectorAll('.mastery-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const rating = parseInt(e.currentTarget.dataset.rating);
            const prevData = srsData[currentFlashcard.id];

            // Only update real SRS state if it's NOT a custom session (or update it anyway, standard practice varies. Let's update anyway so custom training still helps memory).
            const newData = calculateSM2(rating, prevData);
            srsData[currentFlashcard.id] = newData;
            localStorage.setItem('constitution_srs_data', JSON.stringify(srsData));

            if (rating === 0) {
                // If 'Again', throw it back into the current session pool at a random spot
                flashcardSessionPool.splice(Math.floor(Math.random() * flashcardSessionPool.length), 0, currentFlashcard);
            }

            generateNextFlashcard();
        });
    });
}

// --- Custom Training UI ---
function renderTagsSelection() {
    // Extract unique concepts and doctrines
    let allTags = new Set();
    db.articles.forEach(a => {
        if (a.concepts) a.concepts.forEach(t => allTags.add(t));
        if (a.doctrines) a.doctrines.forEach(t => allTags.add(t));
    });

    let sortedTags = Array.from(allTags).sort();

    tagsSelectionContainer.innerHTML = sortedTags.map(tag => `
        <label class="tag-checkbox-label">
            <input type="checkbox" value="${tag}">
            ${tag}
        </label>
    `).join('');

    const checkboxes = tagsSelectionContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', (e) => {
            if (e.target.checked) {
                e.target.parentElement.classList.add('selected');
            } else {
                e.target.parentElement.classList.remove('selected');
            }

            // Enable start button if at least one selected
            const anyChecked = Array.from(checkboxes).some(c => c.checked);
            btnStartCustom.disabled = !anyChecked;
        });
    });
}

btnStartCustom.addEventListener('click', () => {
    const checkboxes = tagsSelectionContainer.querySelectorAll('input[type="checkbox"]:checked');
    const selectedTags = Array.from(checkboxes).map(c => c.value);

    flashcardSessionPool = db.articles.filter(article => {
        const hasConcept = article.concepts && article.concepts.some(t => selectedTags.includes(t));
        const hasDoctrine = article.doctrines && article.doctrines.some(t => selectedTags.includes(t));
        return hasConcept || hasDoctrine;
    });

    if (flashcardSessionPool.length === 0) {
        alert("No articles found for selected tags.");
        return;
    }

    flashcardSessionPool.sort(() => 0.5 - Math.random());
    isCustomSession = true;
    showView('flashcards-view');
});

// --- Argument Trainer & AI Logic ---

function initArgumentTrainer() {
    apiKeyInput.value = aiApiKey;

    // Pick a random case for training
    if (!currentTrainerTopic && db.cases && db.cases.length > 0) {
        currentTrainerTopic = db.cases[Math.floor(Math.random() * db.cases.length)];
    }

    if (currentTrainerTopic) {
        trainerCaseTitle.textContent = currentTrainerTopic.case_name;
        trainerFacts.textContent = currentTrainerTopic.facts;
        trainerIssue.textContent = currentTrainerTopic.issue;
        userArgumentInput.value = '';
        aiFeedbackContent.innerHTML = '<p class="text-muted">Submit your argument to see the AI\'s constitutional evaluation and the actual historical verdict.</p>';

        renderKnowledgeGraph(currentTrainerTopic);
    }
}

btnSaveKey.addEventListener('click', () => {
    aiApiKey = apiKeyInput.value.trim();
    localStorage.setItem('gemini_api_key', aiApiKey);
    alert('API Key Saved!');
});

btnSubmitArgument.addEventListener('click', async () => {
    const userText = userArgumentInput.value.trim();
    if (!userText) {
        alert("Please draft your judgment first.");
        return;
    }
    if (!aiApiKey) {
        alert("Please enter and save your Gemini API Key first to use AI evaluation.");
        return;
    }

    btnSubmitArgument.disabled = true;
    btnSubmitArgument.textContent = "Evaluating...";
    aiFeedbackContent.innerHTML = '<p class="text-gold">Analyzing constitutional consistency...</p>';

    try {
        const feedbackHtml = await evaluateArgumentWithAI(userText, currentTrainerTopic);
        aiFeedbackContent.innerHTML = feedbackHtml;
        
        // Save to argument history
        argumentHistory.push({
            topic: currentTrainerTopic.case_name,
            userArgument: userText,
            timestamp: Date.now()
        });
        // Keep only last 10 arguments
        if (argumentHistory.length > 10) argumentHistory.shift();
        localStorage.setItem('constitution_argument_history', JSON.stringify(argumentHistory));

    } catch (error) {
        console.error(error);
        aiFeedbackContent.innerHTML = `<p style="color: #e74c3c;">Error evaluating argument: ${error.message}</p>`;
    } finally {
        btnSubmitArgument.disabled = false;
        btnSubmitArgument.textContent = "Evaluate Argument";
    }
});


async function evaluateArgumentWithAI(userText, topic) {
    const prompt = `
You are an expert in Constitutional Law.

A law student has drafted a judgment for a hypothetical scenario based on a landmark case.

Case: ${topic.case_name}
Facts: ${topic.facts}
Issue: ${topic.issue}
Actual Holding: ${topic.holding}

Student's Judgment:
"${userText}"

Task:
1. Compare the student's judgment with the actual historical holding.
2. Provide constructive feedback on their reasoning and constitutional consistency.
3. Briefly teach the core concept, including relevant doctrines such as ${topic.keywords
            ? topic.keywords.join(', ')
            : 'constitutional principles'
        }.

Output Format:
Return ONLY raw HTML.
Use only these tags: h4, p, ul, li, strong, em.
Do not use Markdown.
Do not wrap the response in \`\`\`html.
Do not add any introductory or concluding text outside the HTML.
`;

    const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': aiApiKey
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ]
            })
        }
    );

    // Always try to read the response, even when the request failed
    const data = await response.json();

    if (!response.ok) {
        console.error('Gemini API error:', data);

        throw new Error(
            data?.error?.message ||
            `Gemini API request failed with status ${response.status}`
        );
    }

    const text = data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('')
        .trim();

    if (!text) {
        console.error('Unexpected Gemini response:', data);
        throw new Error('Gemini returned an empty response.');
    }

    // Remove Markdown code fences if Gemini ignores the instruction
    return text
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function renderKnowledgeGraph(topic) {
    if (!window.vis) return; // vis.js not loaded

    // Create Nodes
    const nodes = new vis.DataSet([
        { id: 1, label: 'Core Issue', group: 'issue', title: topic.issue },
        { id: 2, label: topic.case_name, group: 'case' }
    ]);

    const edges = new vis.DataSet([
        { from: 1, to: 2, label: 'Decided in' }
    ]);

    let nextId = 3;

    // Add Keywords / Doctrines
    if (topic.keywords && topic.keywords.length > 0) {
        topic.keywords.forEach(kw => {
            nodes.add({ id: nextId, label: kw, group: 'concept' });
            edges.add({ from: 1, to: nextId, label: 'Involves' });
            nextId++;
        });
    }

    nodes.add({ id: nextId, label: 'Constitutional Articles', group: 'article' });
    edges.add({ from: 1, to: nextId, label: 'Interprets' });

    const container = document.getElementById('knowledge-graph');
    const data = { nodes: nodes, edges: edges };
    const options = {
        nodes: {
            shape: 'box',
            font: { color: '#ffffff', face: 'Inter' },
            borderWidth: 2,
            shadow: true
        },
        edges: {
            width: 2,
            font: { color: '#9e9e9e', align: 'top', strokeWidth: 0 },
            arrows: { to: { enabled: true, scaleFactor: 0.5 } }
        },
        groups: {
            issue: { color: { background: '#e74c3c', border: '#c0392b' } },
            case: { color: { background: '#f39c12', border: '#d35400' } },
            concept: { color: { background: '#3498db', border: '#2980b9' } },
            article: { color: { background: '#2ecc71', border: '#27ae60' } }
        },
        physics: {
            stabilization: false,
            barnesHut: { springLength: 150 }
        }
    };

    networkGraph = new vis.Network(container, data, options);
}

// --- Analytics Logic ---
btnGenerateAnalytics.addEventListener('click', async () => {
    if (!aiApiKey) {
        alert("Please enter and save your Gemini API Key in the Argument Trainer first.");
        // Redirect to Argument Trainer to set key
        showView('argument-view');
        return;
    }

    analyticsReportContainer.style.display = 'none';
    analyticsLoading.style.display = 'block';
    btnGenerateAnalytics.disabled = true;

    try {
        // Aggregate data
        const dataPayload = {
            srsData: srsData,
            argumentHistory: argumentHistory
        };

        const prompt = `
You are an expert AI Law Tutor for Indian Constitutional Law.
The user is a student studying the Indian Constitution.
I will provide their learning data, which includes:
1. Spaced Repetition (SRS) Data: Shows their mastery interval (higher = better retention) and repetitions.
2. Argument History: The last few arguments they drafted for hypothetical cases.

Analyze this data and provide a comprehensive learning report with exactly these sections:
1. Strengths and Weaknesses
2. Knowledge Gaps
3. Possible Misconceptions
4. Learning Patterns
5. Personalized Learning Path (recommend specific doctrines or tags to study next)

Data Payload:
${JSON.stringify(dataPayload, null, 2)}

Formatting Rules:
- Return ONLY valid HTML. No markdown formatting (\`\`\`html). No intro/outro text.
- Use <h3> for section headers.
- Use <div class="alert-box">...</div> to highlight Misconceptions or Weaknesses.
- Use <div class="success-box">...</div> to highlight Strengths.
- For the Personalized Learning Path, generate actionable buttons using this exact HTML structure for tags to study:
  <button class="learning-path-btn" data-tag="Fundamental Rights">Study Fundamental Rights</button>
  (Replace "Fundamental Rights" with your actual suggested tags based on their gaps).
`;

        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': aiApiKey
                },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }]
                })
            }
        );

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        let reportHtml = data.candidates[0].content.parts[0].text;
        
        // Clean up formatting just in case
        reportHtml = reportHtml.replace(/^```html|```$/gi, '').trim();

        analyticsReportContainer.innerHTML = reportHtml;
        analyticsLoading.style.display = 'none';
        analyticsReportContainer.style.display = 'block';

    } catch (error) {
        console.error("Analytics Error:", error);
        analyticsLoading.style.display = 'none';
        analyticsReportContainer.style.display = 'block';
        analyticsReportContainer.innerHTML = `<div class="alert-box">Error generating analytics: ${error.message}</div>`;
    } finally {
        btnGenerateAnalytics.disabled = false;
    }
});

// Event Delegation for dynamic Learning Path buttons
analyticsReportContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('learning-path-btn')) {
        const tag = e.target.getAttribute('data-tag');
        if (tag) {
            // Trigger a custom session for this tag
            activeTagFilter = tag;
            generateCustomFlashcards(tag);
            if (flashcardSessionPool.length > 0) {
                showView('flashcards-view');
            } else {
                alert(`No flashcards found for the tag: ${tag}. Try another one.`);
            }
        }
    }
});

// Init
updateDashboard();

// Global Search Logic
window.handleSearch = function(query) {
    const dropdown = document.getElementById('search-dropdown');
    const resultsList = document.getElementById('search-results-list');
    
    if (!query || query.trim().length < 2) {
        dropdown.style.display = 'none';
        return;
    }
    
    query = query.toLowerCase().trim();
    
    // Search articles
    const articleResults = db.articles.filter(a => 
        (a.title && a.title.toLowerCase().includes(query)) || 
        (a.text && a.text.toLowerCase().includes(query)) ||
        (a.concepts && a.concepts.some(c => c.toLowerCase().includes(query)))
    ).slice(0, 5);
    
    // Search cases
    const caseResults = (db.cases || []).filter(c => 
        (c.case_name && c.case_name.toLowerCase().includes(query)) ||
        (c.issue && c.issue.toLowerCase().includes(query))
    ).slice(0, 3);
    
    resultsList.innerHTML = '';
    
    if (articleResults.length === 0 && caseResults.length === 0) {
        resultsList.innerHTML = '<li class="search-result-item text-muted">No results found</li>';
    } else {
        articleResults.forEach(a => {
            const li = document.createElement('li');
            li.className = 'search-result-item';
            li.innerHTML = `
                <div class="search-result-title">Article ${a.article === "0" ? "Preamble" : a.article}: ${a.title}</div>
                <div class="search-result-desc">${a.text}</div>
            `;
            li.onclick = () => {
                renderArticleDetail(a);
                showView('article-view');
                dropdown.style.display = 'none';
                document.getElementById('global-search').value = '';
            };
            resultsList.appendChild(li);
        });
        
        caseResults.forEach(c => {
            const li = document.createElement('li');
            li.className = 'search-result-item';
            li.innerHTML = `
                <div class="search-result-title">Case: ${c.case_name}</div>
                <div class="search-result-desc">${c.issue}</div>
            `;
            li.onclick = () => {
                openCase(c.case_name);
                dropdown.style.display = 'none';
                document.getElementById('global-search').value = '';
            };
            resultsList.appendChild(li);
        });
    }
    
    dropdown.style.display = 'block';
};

// Hide dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.hero-search-container')) {
        const dropdown = document.getElementById('search-dropdown');
        if (dropdown) dropdown.style.display = 'none';
    }
});
