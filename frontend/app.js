// Global state tracking
let provider = null;
let signer = null;
let userAddress = null;
let currentReport = null;

// Local fallback reports in case backend network is interrupted
const FALLBACK_REPORTS = {
  "risky": {
    "score": 5,
    "address": "0x8e5da9c82e0449c421c7a002b7606206ee445d01",
    "canonical_report": '{"address":"0x8e5da9c82e0449c421c7a002b7606206ee445d01","score":5}',
    "report_hash": "0x1111111111111111111111111111111111111111111111111111111111111111",
    "breakdown": [
      {"factor": "Contract Approvals", "points": 0, "max": 40, "evidence": "Unlimited allowance to unverified contract"},
      {"factor": "Transaction History", "points": 5, "max": 30, "evidence": "High frequency interactions with flagged pools"},
      {"factor": "Key Hygiene", "points": 0, "max": 30, "evidence": "Exposed state activity"}
    ],
    "recommendations": [
      {"action": "Revoke unlimited token approvals", "gain": 40},
      {"action": "Disconnect active sessions", "gain": 20}
    ]
  },
  "clean": {
    "score": 85,
    "address": "0x8e5da9c82e0449c421c7a002b7606206ee445d01",
    "canonical_report": '{"address":"0x8e5da9c82e0449c421c7a002b7606206ee445d01","score":85}',
    "report_hash": "0x2222222222222222222222222222222222222222222222222222222222222222",
    "breakdown": [
      {"factor": "Contract Approvals", "points": 35, "max": 40, "evidence": "Minimal active allowances"},
      {"factor": "Transaction History", "points": 25, "max": 30, "evidence": "Clean interaction history"},
      {"factor": "Key Hygiene", "points": 25, "max": 30, "evidence": "No high-risk approvals"}
    ],
    "recommendations": []
  },
  "risky_fixed": {
    "score": 65,
    "address": "0x8e5da9c82e0449c421c7a002b7606206ee445d01",
    "canonical_report": '{"address":"0x8e5da9c82e0449c421c7a002b7606206ee445d01","score":65}',
    "report_hash": "0x3333333333333333333333333333333333333333333333333333333333333333",
    "breakdown": [
      {"factor": "Contract Approvals", "points": 40, "max": 40, "evidence": "Approvals revoked successfully"},
      {"factor": "Transaction History", "points": 5, "max": 30, "evidence": "High frequency interactions with flagged pools"},
      {"factor": "Key Hygiene", "points": 20, "max": 30, "evidence": "Active sessions secured"}
    ],
    "recommendations": [
      {"action": "Migrate funds to fresh multisig vault", "gain": 20}
    ]
  },
  "sample": {
    "score": 42,
    "address": "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",
    "canonical_report": '{"address":"0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be","score":42}',
    "report_hash": "0x4444444444444444444444444444444444444444444444444444444444444444",
    "breakdown": [
      {"factor": "Contract Approvals", "points": 15, "max": 40, "evidence": "Medium risk token allowances found"},
      {"factor": "Transaction History", "points": 15, "max": 30, "evidence": "Interactions with unverified DEX router"},
      {"factor": "Key Hygiene", "points": 12, "max": 30, "evidence": "Unused key pairs linked"}
    ],
    "recommendations": [
      {"action": "Limit DEX router permissions", "gain": 25},
      {"action": "Rotate operational key pair", "gain": 18}
    ]
  },
  "resilient": {
    "score": 98,
    "address": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    "canonical_report": '{"address":"0xd8da6bf26964af9d7eed9e03e53415d37aa96045","score":98}',
    "report_hash": "0x5555555555555555555555555555555555555555555555555555555555555555",
    "breakdown": [
      {"factor": "Contract Approvals", "points": 40, "max": 40, "evidence": "Zero active open allowances"},
      {"factor": "Transaction History", "points": 29, "max": 30, "evidence": "Verified Gnosis Safe multi-sig usage"},
      {"factor": "Key Hygiene", "points": 29, "max": 30, "evidence": "Hardware wallet signing detected"}
    ],
    "recommendations": []
  }
};

// Initialize telemetry on document load
document.addEventListener('DOMContentLoaded', async () => {
  fetchBenchmark();
  // Perform initial wallet profile analysis
  window.analyzeWallet();
});

// Fetch Global Benchmark from Backend API
async function fetchBenchmark() {
  try {
    const res = await fetch(`${BACKEND_URL}/benchmark`);
    if (res.ok) {
      const data = await res.json();
      const benchEl = document.getElementById('benchmark-value');
      if (benchEl) benchEl.innerText = data.average || 52;
    }
  } catch (err) {
    console.warn("Backend benchmark offline, using default 52:", err);
  }
}

// Connect MetaMask Web3 Wallet
window.connectWallet = async function() {
  const btnText = document.getElementById('wallet-btn-text');
  const netStatus = document.getElementById('network-status');
  
  if (!window.ethereum) {
    alert("MetaMask extension not detected. Please install MetaMask to enable Web3 signing.");
    return;
  }
  
  try {
    if (btnText) btnText.innerText = "Connecting...";
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();
    
    // Verify Network Chain ID (Sepolia = 11155111 / 0xaa36a7)
    const network = await provider.getNetwork();
    const chainIdNumber = Number(network.chainId);
    
    if (chainIdNumber !== CONFIG.CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }],
        });
      } catch (switchError) {
        console.warn("Chain switch request:", switchError);
      }
    }
    
    if (btnText) {
      btnText.innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
    }
    if (netStatus) {
      netStatus.querySelector('.status-dot').className = "status-dot connected";
    }
    
    updateContractStatus(`Connected to Web3 Account: ${userAddress}`);
  } catch (err) {
    console.error("Wallet Connection Error:", err);
    if (btnText) btnText.innerText = "Connect Wallet";
    alert("Failed to connect wallet: " + err.message);
  }
};

// Fetch Wallet Assessment Report
window.analyzeWallet = async function() {
  const inputEl = document.getElementById('wallet-input');
  const selectEl = document.getElementById('wallet-select');
  
  let selectedKey = 'risky';
  if (inputEl && inputEl.value.trim() !== '') {
    selectedKey = inputEl.value.trim();
  } else if (selectEl && selectEl.value) {
    selectedKey = selectEl.value;
  }
  
  const scoreValEl = document.getElementById('score-value');
  if (scoreValEl) scoreValEl.innerText = "..";
  
  let reportData = null;
  
  try {
    // Try path route /score/<wallet_id>, then query route /score?wallet=<wallet_id>
    let res;
    try {
      res = await fetch(`${BACKEND_URL}/score/${encodeURIComponent(selectedKey)}`);
      if (!res.ok) throw new Error("Path route fallback");
    } catch (e) {
      res = await fetch(`${BACKEND_URL}/score?wallet=${encodeURIComponent(selectedKey)}`);
    }
    
    if (res && res.ok) {
      reportData = await res.json();
    }
  } catch (err) {
    console.warn("Backend fetch unreachable, using local fallback report:", err);
  }
  
  // Fallback to local dataset if backend is unreachable
  if (!reportData) {
    const keyLower = selectedKey.toLowerCase();
    reportData = FALLBACK_REPORTS[keyLower] || FALLBACK_REPORTS["risky"];
  }
  
  currentReport = reportData;
  renderReport(reportData);
};

// Render Assessment Report to DOM
function renderReport(report) {
  // Update Target Address
  const addrEl = document.getElementById('active-address');
  if (addrEl) addrEl.innerText = report.address || "0x8e5da9c82e0449c421c7a002b7606206ee445d01";
  
  // Update Score & Status Gauge
  const score = report.score ?? 0;
  const scoreValEl = document.getElementById('score-value');
  const statusEl = document.getElementById('score-status-text');
  const gaugeProgress = document.getElementById('gauge-progress');
  const ratingEl = document.getElementById('telemetry-rating');
  const descEl = document.getElementById('score-description');
  
  if (scoreValEl) scoreValEl.innerText = score;
  
  // Circumference = 2 * PI * 70 = 439.82
  const offset = 440 - (score / 100) * 440;
  if (gaugeProgress) {
    gaugeProgress.style.strokeDashoffset = offset;
    if (score < 40) {
      gaugeProgress.style.stroke = "#dc2626"; // Red
    } else if (score < 75) {
      gaugeProgress.style.stroke = "#f59e0b"; // Amber
    } else {
      gaugeProgress.style.stroke = "#10b981"; // Green
    }
  }
  
  if (statusEl) {
    if (score < 40) {
      statusEl.innerText = "HIGH RISK CRITICAL";
      statusEl.style.color = "#dc2626";
      if (ratingEl) ratingEl.innerText = "CRITICAL F";
      if (descEl) descEl.innerText = "Severe vulnerabilities detected. High risk of asset drain via unlimited contract allowances.";
    } else if (score < 75) {
      statusEl.innerText = "MODERATE RISK";
      statusEl.style.color = "#f59e0b";
      if (ratingEl) ratingEl.innerText = "WARNING C";
      if (descEl) descEl.innerText = "Moderate exposure detected. Security hygiene recommendations available to boost health score.";
    } else {
      statusEl.innerText = "SECURE / HEALTHY";
      statusEl.style.color = "#10b981";
      if (ratingEl) ratingEl.innerText = "SECURE A+";
      if (descEl) descEl.innerText = "Excellent wallet security posture. Minimal contract allowances and clean transaction history.";
    }
  }
  
  // Calculate potential gain
  const recs = report.recommendations || [];
  const totalGain = recs.reduce((sum, r) => sum + (r.gain || 0), 0);
  const gainEl = document.getElementById('telemetry-gain');
  if (gainEl) gainEl.innerText = `+${totalGain} PTS`;
  
  // Populate Section 02 Factors
  const factorListEl = document.getElementById('factor-list');
  if (factorListEl) {
    factorListEl.innerHTML = '';
    const breakdown = report.breakdown || [];
    breakdown.forEach(f => {
      const pct = Math.round((f.points / f.max) * 100);
      let fillClass = "";
      if (pct < 40) fillClass = "";
      else if (pct < 75) fillClass = "medium";
      else fillClass = "high";
      
      const row = document.createElement('div');
      row.className = 'factor-item';
      row.innerHTML = `
        <div class="factor-header">
          <span class="factor-title">${f.factor}</span>
          <span class="factor-points">${f.points} / ${f.max} PTS</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${fillClass}" style="width: ${pct}%"></div>
        </div>
        <div class="factor-evidence">${f.evidence}</div>
      `;
      factorListEl.appendChild(row);
    });
  }
  
  // Populate Section 03 Recommendations
  const recContainer = document.getElementById('recommendations');
  if (recContainer) {
    recContainer.innerHTML = '';
    if (recs.length === 0) {
      recContainer.innerHTML = `<div class="no-recs">✔ No immediate remediation actions required. Wallet profile is fully optimized.</div>`;
    } else {
      recs.forEach(r => {
        const item = document.createElement('div');
        item.className = 'rec-item';
        item.innerHTML = `
          <span class="rec-action">🛡️ ${r.action}</span>
          <span class="rec-gain">+${r.gain} PTS</span>
        `;
        recContainer.appendChild(item);
      });
    }
  }
  
  // Populate Section 04 Cryptographic Integrity
  const canonEl = document.getElementById('canonical-report');
  const hashEl = document.getElementById('report-hash');
  if (canonEl) canonEl.value = report.canonical_report || JSON.stringify({ address: report.address, score: report.score });
  if (hashEl) hashEl.innerText = report.report_hash || "0x----------------------------------------------------------------";
  
  // Reset Integrity status banner
  const statusBanner = document.getElementById('integrity-status');
  if (statusBanner) {
    statusBanner.className = "status-banner info hidden";
  }
}

// Verify Cryptographic Report Integrity via POST /hash
window.verifyIntegrity = async function() {
  const canonEl = document.getElementById('canonical-report');
  const hashEl = document.getElementById('report-hash');
  const statusBanner = document.getElementById('integrity-status');
  
  if (!canonEl || !hashEl || !statusBanner) return;
  
  const text = canonEl.value;
  try {
    const res = await fetch(`${BACKEND_URL}/hash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    });
    
    if (!res.ok) throw new Error("Hash endpoint error");
    const data = await res.json();
    const computedHash = data.hash;
    const expectedHash = currentReport ? currentReport.report_hash : "";
    
    statusBanner.classList.remove('hidden');
    if (computedHash.toLowerCase() === expectedHash.toLowerCase()) {
      statusBanner.className = "status-banner success";
      statusBanner.innerHTML = `<strong>✔ INTEGRITY VERIFIED:</strong> SHA-256 hash matching report anchor (${computedHash.substring(0, 16)}...)`;
    } else {
      statusBanner.className = "status-banner error";
      statusBanner.innerHTML = `<strong>⚠️ INTEGRITY MISMATCH DETECTED:</strong> Computed: <span class="mono">${computedHash.substring(0, 18)}...</span> | Registered Anchor: <span class="mono">${expectedHash.substring(0, 18)}...</span>`;
    }
  } catch (err) {
    console.error("Verification failed:", err);
    statusBanner.classList.remove('hidden');
    statusBanner.className = "status-banner error";
    statusBanner.innerText = "Error reaching hash verification endpoint: " + err.message;
  }
};

// Test Tampering on Canonical Report
window.tamperReport = function() {
  const canonEl = document.getElementById('canonical-report');
  if (!canonEl) return;
  
  try {
    let parsed = JSON.parse(canonEl.value);
    parsed.score = (parsed.score || 0) + 50; // Modify score
    parsed.tampered = true;
    canonEl.value = JSON.stringify(parsed);
  } catch (e) {
    canonEl.value += " [TAMPERED_PAYLOAD]";
  }
  
  // Trigger verification check automatically to show tamper detection
  window.verifyIntegrity();
};

// Save Report Hash On-Chain to Sepolia Smart Contract
window.saveOnChain = async function() {
  if (!currentReport) {
    alert("Please analyze a wallet report first.");
    return;
  }
  
  if (!signer) {
    await window.connectWallet();
    if (!signer) return;
  }
  
  const contractStatus = document.getElementById('contract-status');
  updateContractStatus("Broadcasting transaction to Sepolia testnet...");
  
  try {
    const contractAbi = ["function store(address,uint8,bytes32) returns (uint256)"];
    const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, contractAbi, signer);
    
    // Parameters: address, score, reportHash
    const walletAddr = currentReport.address;
    const scoreVal = currentReport.score;
    let hashVal = currentReport.report_hash;
    
    // Ensure hash has 0x prefix and is 32 bytes
    if (!hashVal.startsWith('0x')) hashVal = '0x' + hashVal;
    
    updateContractStatus(`Requesting MetaMask signature for contract store(${walletAddr.substring(0, 8)}..., ${scoreVal}, ${hashVal.substring(0, 10)}...)...`);
    
    const tx = await contract.store(walletAddr, scoreVal, hashVal);
    updateContractStatus(`Transaction submitted! Hash: ${tx.hash}. Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    updateContractStatus(`✔ ON-CHAIN ANCHORED SUCCESS! Block #${receipt.blockNumber} | Tx: ${receipt.hash}`);
    
    const anchorEl = document.getElementById('telemetry-anchor');
    if (anchorEl) anchorEl.innerText = `BLOCK #${receipt.blockNumber}`;
  } catch (err) {
    console.error("On-chain Save Error:", err);
    updateContractStatus(`⚠️ On-Chain Action Status: ${err.message || err}`);
  }
};

function updateContractStatus(msg) {
  const el = document.getElementById('contract-status');
  if (el) el.innerText = msg;
}

// AI Security Assistant Chat Logic
window.askAI = function(questionText) {
  const inputEl = document.getElementById('chat-input');
  if (inputEl) {
    inputEl.value = questionText;
    window.handleChatSubmit(new Event('submit'));
  }
};

window.handleChatSubmit = function(e) {
  if (e) e.preventDefault();
  const inputEl = document.getElementById('chat-input');
  const chatLog = document.getElementById('chat-log');
  
  if (!inputEl || !chatLog) return;
  const query = inputEl.value.trim();
  if (!query) return;
  
  // Append User Message
  appendChatMessage(chatLog, 'USER', query, 'user');
  inputEl.value = '';
  
  // Generate Response based on active currentReport context
  setTimeout(() => {
    const response = generateAIResponse(query);
    appendChatMessage(chatLog, 'SECURITY ASSISTANT AI', response, 'ai');
  }, 400);
};

function appendChatMessage(container, author, text, type) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${type}`;
  msgDiv.innerHTML = `
    <div class="msg-author">${author}</div>
    <div class="msg-content">${text}</div>
  `;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function generateAIResponse(query) {
  const q = query.toLowerCase();
  const report = currentReport || { score: 5, address: "0x8e5d...", breakdown: [] };
  const score = report.score ?? 5;
  
  if (q.includes("explain my risk score") || q.includes("risk score") || q.includes("score")) {
    return `Your current wallet health score is <strong>${score}/100</strong>. ` +
      (score < 40 
        ? `This critical score is primarily driven by open, unlimited ERC-20/721 token approvals to unverified smart contracts and flagged protocol interactions.`
        : `Your score reflects clean key hygiene and low active approval risk across verified contracts.`);
  }
  
  if (q.includes("fix") || q.includes("vulnerabilit") || q.includes("remediat") || q.includes("action")) {
    const recs = report.recommendations || [];
    if (recs.length === 0) {
      return `No urgent remediation needed! Your wallet score is <strong>${score}/100</strong> with no active high-risk approvals detected.`;
    }
    const actionsStr = recs.map(r => `• ${r.action} (+${r.gain} pts)`).join('<br>');
    return `To improve your score by up to <strong>+${recs.reduce((s,r)=>s+r.gain,0)} points</strong>, execute these steps:<br>${actionsStr}`;
  }
  
  if (q.includes("anchor") || q.includes("hash") || q.includes("chain") || q.includes("sepolia")) {
    return `On-chain hash anchoring posts the SHA-256 cryptographic digest of your canonical audit report (<code>${(report.report_hash || '0x111...').substring(0, 16)}...</code>) directly to the Sepolia testnet contract (<code>${CONFIG.CONTRACT_ADDRESS.substring(0, 10)}...</code>). This prevents tamper risks and provides immutability.`;
  }
  
  if (q.includes("benchmark") || q.includes("compare") || q.includes("average")) {
    const benchEl = document.getElementById('benchmark-value');
    const benchVal = benchEl ? benchEl.innerText : "52";
    const diff = score - parseInt(benchVal);
    const comparison = diff >= 0 ? `${diff} points ABOVE` : `${Math.abs(diff)} points BELOW`;
    return `The global wallet health benchmark average is <strong>${benchVal}/100</strong>. Your wallet score of <strong>${score}/100</strong> is ${comparison} the network benchmark.`;
  }
  
  return `Based on active telemetry for address <code>${(report.address || '').substring(0, 10)}...</code> (Score: ${score}/100), key factors include: ` +
    (report.breakdown || []).map(b => `${b.factor}: ${b.points}/${b.max} pts`).join(', ') + `. Ask me "Explain my risk score" or "How do I fix vulnerabilities?" for specific guidance.`;
}
