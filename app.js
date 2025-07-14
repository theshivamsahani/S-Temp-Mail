const emailInput = document.getElementById('emailInput');
const refreshBtn = document.getElementById('refreshBtn');
const changeBtn = document.getElementById('changeBtn');
const deleteBtn = document.getElementById('deleteBtn');
const copyBtn = document.getElementById('copyBtn');
const emailsList = document.getElementById('emailsList');
const viewer = document.getElementById('emailViewer');
const closeViewer = document.getElementById('closeViewer');
const emailSubject = document.getElementById('emailSubject');
const emailFrom = document.getElementById('emailFrom');
const emailBody = document.getElementById('emailBody');
const attachmentSection = document.getElementById('attachmentSection');
const newMailSound = document.getElementById('newMailSound');

let token = null;
let account = null;
let lastEmailIds = [];

async function api(path, method = 'GET', body = null) {
  const res = await fetch(`https://api.mail.tm${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : null
  });
  return res.json();
}

async function generateAccount() {
  const saved = localStorage.getItem('tempMailAccount');

  if (saved) {
    try {
      account = JSON.parse(saved);
      const login = await api('/token', 'POST', account);
      token = login.token;
      emailInput.value = account.address;
      fetchInbox();
      return;
    } catch {
      localStorage.removeItem('tempMailAccount');
    }
  }

  const domainRes = await api('/domains');
const domains = domainRes['hydra:member'];
const randomIndex = Math.floor(Math.random() * domains.length);
const domain = domains[randomIndex].domain;
  const address = `user${Date.now().toString().slice(-4)}@${domain}`;
  const password = Math.random().toString(36).slice(-10);

  try {
    await api('/accounts', 'POST', { address, password });
    account = { address, password };
    localStorage.setItem('tempMailAccount', JSON.stringify(account));
    const login = await api('/token', 'POST', account);
    token = login.token;
    emailInput.value = address;
    fetchInbox();
  } catch (err) {
    console.error("Failed to create account", err);
  }
}

async function fetchInbox() {
  if (!token) return;
  const res = await api('/messages');
  const emails = res['hydra:member'];
  emailsList.innerHTML = '';

  const currentIds = emails.map(msg => msg.id);
  const newEmails = currentIds.filter(id => !lastEmailIds.includes(id));
  const hasRefreshed = localStorage.getItem('mailRefreshedOnce');

  if (newEmails.length > 0 && !hasRefreshed) {
    newMailSound.play();
    localStorage.setItem('mailRefreshedOnce', 'true');
    setTimeout(() => location.reload(), 800);
    return;
  }

  lastEmailIds = currentIds;

  emails.forEach(msg => {
    const li = document.createElement('li');
    li.dataset.id = msg.id;
    li.className = msg.seen ? '' : 'unread';
    li.innerHTML = `
      <div><strong>${msg.from?.address || 'Unknown Sender'}</strong></div>
      <div>${msg.subject || '(No Subject)'}</div>
    `;
    li.addEventListener('click', () => openMessage(msg.id, li));
    emailsList.appendChild(li);
  });
}

async function openMessage(id, listItem) {
  const msg = await api(`/messages/${id}`);
  listItem.classList.remove('unread');
  emailSubject.textContent = msg.subject || '(No Subject)';
  emailFrom.textContent = msg.from?.address || '(Unknown Sender)';
  emailBody.innerHTML = msg.html || msg.text || '(No content)';
  attachmentSection.innerHTML = '';

  if (msg.attachments && msg.attachments.length > 0) {
    msg.attachments.forEach(att => {
      const a = document.createElement('a');
      a.href = att.downloadUrl || att.url;
      a.textContent = ` ${att.filename}`;
      a.target = '_blank';
      attachmentSection.appendChild(a);
    });
  }

  viewer.classList.remove('hidden');
}

closeViewer.addEventListener('click', () => {
  viewer.classList.add('hidden');
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(emailInput.value);
  copyBtn.textContent = ' Copied!';
  setTimeout(() => copyBtn.textContent = ' Copy', 2000);
});

changeBtn.addEventListener('click', () => {
  viewer.classList.add('hidden');
  localStorage.removeItem('tempMailAccount');
  localStorage.removeItem('mailRefreshedOnce');
  generateAccount();
});
deleteBtn.addEventListener('click', () => {
  if (confirm('Delete this mailbox and create a new one?')) {
    token = null;
    emailsList.innerHTML = '';
    emailInput.value = '';
    viewer.classList.add('hidden');
    localStorage.removeItem('tempMailAccount');
    localStorage.removeItem('mailRefreshedOnce');
    generateAccount();
  }
});

refreshBtn.addEventListener('click', fetchInbox);

window.addEventListener('load', () => {
  generateAccount();
  setInterval(fetchInbox, 30000); // Auto-refresh every 30s
});
