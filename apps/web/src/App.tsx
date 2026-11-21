
import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ShieldCheck, LayoutDashboard, Layers, Users, Award,
  LogOut, Menu, X, Plus, Upload, RefreshCw
} from "lucide-react";
import "./App.css";
import React from "react";

const API = "http://localhost:3001/api";

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/auth/login", { email, password });
      console.log("Login successful:", data);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user || {}));
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="brand">
          <div className="brand-icon"><ShieldCheck /></div>
          <span>CertiFlow</span>
        </div>

        <div className="login-content">
          <div className="welcome-tag">DIGITAL CERTIFICATION PLATFORM</div>
          <h1>Skills verified.<br /><span>Achievements recognized.</span></h1>
          <p className="login-description">
            A transparent, secure and seamless certification ecosystem
            connecting training centres, reviewers and learners.
          </p>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label>Email address</label>
              <input type="email" placeholder="you@organization.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" placeholder="Enter your password"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button className="login-button" disabled={loading}>
              {loading ? "Signing in..." : "Sign in →"}
            </button>
          </form>
          <div className="login-footer">
            <ShieldCheck size={16} /> Secure access to your workspace
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="hero-content">
          <div className="hero-badge">TRUSTED CERTIFICATION</div>
          <h2>Every achievement<br />deserves <span>to be verified.</span></h2>
          <p>From training to certification, bring every step of the
            verification journey into one secure platform.</p>
          <div className="feature-list">
            <div className="feature-item"><div className="feature-icon"><Layers /></div>
              <div><h3>Training management</h3><p>Manage batches and candidates.</p></div></div>
            <div className="feature-item"><div className="feature-icon"><Users /></div>
              <div><h3>Multi-level approval</h3><p>Transparent review workflows.</p></div></div>
            <div className="feature-item"><div className="feature-icon"><ShieldCheck /></div>
              <div><h3>Instant verification</h3><p>Verify credentials through QR codes.</p></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user.role || "TRAINING_CENTER";
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [batchNumber, setBatchNumber] = useState("");
  const [courseName, setCourseName] = useState("");
  const [district, setDistrict] = useState(user.district || "Hyderabad");
  const [candidateText, setCandidateText] = useState(
    "C001,Rahul Kumar,9876543210,rahul@gmail.com\nC002,Priya Sharma,9876543211,priya@gmail.com"
  );

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvBatchNumber, setCsvBatchNumber] = useState("");
  const [csvCourse, setCsvCourse] = useState("");
  const [csvDistrict, setCsvDistrict] = useState(user.district || "Hyderabad");

  const [message, setMessage] = useState("");

  const roleLabels: Record<string, string> = {
    TRAINING_CENTER: "Training Centre",
    DISTRICT_OFFICER: "District Officer",
    QUALITY_REVIEWER: "Quality Reviewer",
    STATE_ADMIN: "State Administrator",
  };

  async function fetchBatches() {
    setLoading(true);
    setError("");
    try {
      let endpoint = "/batches/my-batches";

      if (role === "DISTRICT_OFFICER") endpoint = "/batches/pending";
      if (role === "STATE_ADMIN") endpoint = "/batches/state-pending";

      const { data } = await api.get(endpoint);
      setBatches(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.message || "Unable to load batches");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBatches();
  }, []);

  function logout() {
    localStorage.clear();
    navigate("/");
  }

  async function createBatch(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    try {
      const candidates = candidateText.split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
          const [candidateId, fullName, phone, email] = line.split(",").map(v => v.trim());
          return { candidateId, fullName, phone, email: email || undefined };
        });

      await api.post("/batches", {
        batchNumber, courseName, district, candidates
      });

      setMessage("Batch created successfully!");
      setShowCreate(false);
      setBatchNumber("");
      setCourseName("");
      await fetchBatches();
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Batch creation failed");
    }
  }

  async function uploadCSV(e: React.FormEvent) {
    e.preventDefault();
    if (!csvFile) return setMessage("Please select a CSV file.");

    const formData = new FormData();
    formData.append("batchNumber", csvBatchNumber);
    formData.append("courseName", csvCourse);
    formData.append("district", csvDistrict);
    formData.append("file", csvFile);

    try {
      await api.post("/batches/upload-csv", formData);
      setMessage("CSV batch uploaded successfully!");
      setShowCSV(false);
      setCsvFile(null);
      await fetchBatches();
    } catch (err: any) {
      setMessage(err.response?.data?.message || "CSV upload failed");
    }
  }

  async function submitBatch(id: string) {
    try {
      await api.patch(`/batches/${id}/submit`);
      setMessage("Batch submitted for approval!");
      await fetchBatches();
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Submission failed");
    }
  }

  async function downloadCertificate(certificateId: string) {
    try {
      const res = await api.get(`/certificates/${certificateId}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "certificate.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Certificate download failed");
    }
  }

  async function retryDelivery(deliveryId: string) {
    try {
      const { data } = await api.post(`/certificates/deliveries/${deliveryId}/retry`);
      setMessage(`${data.message} (Simulated WhatsApp)`);
      await fetchBatches();
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Delivery retry failed");
    }
  }

  const candidateCount = batches.reduce((sum, b) =>
    sum + (b.candidateCount ?? b.candidates?.length ?? 0), 0);

  const certificateCount = batches.reduce((sum, b) =>
    sum + (b.certificateCount ??
      b.candidates?.filter((c: any) => c.certificate).length ?? 0), 0);

  const pendingCount = batches.filter(b =>
    ["DRAFT", "SUBMITTED", "DISTRICT_REVIEW", "QUALITY_REVIEW", "STATE_REVIEW"]
      .includes(b.status)).length;

  return (
    <div className="dashboard-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon"><ShieldCheck /></div>
          CertiFlow
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><X /></button>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav">
          <button className="nav-item nav-active"><LayoutDashboard size={18}/>Dashboard</button>
          <button className="nav-item" onClick={() => setShowCreate(true)}><Plus size={18}/>Create Batch</button>
          <button className="nav-item" onClick={() => setShowCSV(true)}><Upload size={18}/>CSV Upload</button>
          <button className="nav-item" onClick={fetchBatches}><Layers size={18}/>Batches</button>
        </nav>

        <div className="sidebar-bottom">
          <button className="nav-item logout-item" onClick={logout}><LogOut size={18}/>Sign out</button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu /></button>
          <div><p className="header-label">CERTIFLOW WORKSPACE</p><h2>Dashboard</h2></div>
          <div className="header-user">
            <div className="user-avatar">{(user.name || "U")[0].toUpperCase()}</div>
            <div className="header-user-info"><strong>{user.name || "User"}</strong><span>{roleLabels[role] || role}</span></div>
          </div>
        </header>

        <div className="dashboard-content">
          <div className="welcome-card">
            <div><p className="welcome-eyebrow">WORKSPACE OVERVIEW</p>
              <h1>Welcome, {user.name || "User"}!</h1>
              <p>Track your certification batches and workflow.</p></div>
            <div className="welcome-card-icon"><ShieldCheck size={38}/></div>
          </div>

          {message && <div className="login-error" style={{background:"#eff6ff",color:"#1d4ed8",marginTop:20}}>{message}</div>}
          {role === "DISTRICT_OFFICER" && <DistrictReviewPanel />}
          {role === "STATE_ADMIN" && <StateAdminPanel />}

          <div className="dashboard-grid">
            <div className="stat-card"><div className="stat-icon blue"><Layers/></div><span>Total Batches</span><h2>{batches.length}</h2></div>
            <div className="stat-card"><div className="stat-icon purple"><Users/></div><span>Total Candidates</span><h2>{candidateCount}</h2></div>
            <div className="stat-card"><div className="stat-icon green"><Award/></div><span>Certificates</span><h2>{certificateCount}</h2></div>
            <div className="stat-card"><div className="stat-icon orange"><LayoutDashboard/></div><span>Pending</span><h2>{pendingCount}</h2></div>
          </div>

          <div className="content-panel">
            <div className="panel-heading panel-flex">
              <div><h3>Batches</h3><p>Your batch records and workflow status</p></div>
              <div className="action-buttons">
                <button className="secondary-button" onClick={fetchBatches}><RefreshCw size={16}/>Refresh</button>
                {role === "TRAINING_CENTER" && <button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={16}/>Create</button>}
                {role === "TRAINING_CENTER" && <button className="secondary-button" onClick={() => setShowCSV(true)}><Upload size={16}/>CSV</button>}
              </div>
            </div>

            {loading ? <p className="table-message">Loading batches...</p> :
              error ? <p className="table-message">{error}</p> :
              batches.length === 0 ? <div className="empty-state"><div className="empty-state-icon"><Layers/></div><h3>No batches found</h3><p>Create or submit a batch to get started.</p></div> :
              <div className="table-scroll"><table className="batch-table">
                <thead><tr><th>Batch</th><th>Course</th><th>Candidates</th><th>Certificates</th><th>Status / Progress</th><th>Action</th></tr></thead>
                <tbody>{batches.map(b => {
                  const count = b.candidateCount ?? b.candidates?.length ?? 0;
                  const certs = b.certificateCount ?? b.candidates?.filter((c: any) => c.certificate).length ?? 0;
                  const districtApprovals = b.approvals?.filter((a: any) => a.stage === "DISTRICT" && a.decision === "APPROVED" && a.reviewCycle === b.reviewCycle).length ?? 0;
                  const latestComment = b.approvals?.find((a: any) => a.comment)?.comment;
                  const firstCertificate = b.candidates?.find((c: any) => c.certificate)?.certificate;
                  return <tr key={b.id}>
                    <td><strong>{b.batchNumber}</strong></td>
                    <td>{b.courseName}</td>
                    <td>{count}</td>
                    <td>{certs}</td>
                    <td>
                      <span className={`status status-${b.status}`}>{b.status?.replaceAll("_"," ")}</span>
                      {["DISTRICT_REVIEW","STATE_REVIEW"].includes(b.status) && <small className="progress-text">District: {districtApprovals}/2</small>}
                      {latestComment && b.status === "RETURNED" && <small className="progress-text">Reason: {latestComment}</small>}
                    </td>
                    <td>{role === "TRAINING_CENTER" && ["DRAFT","RETURNED"].includes(b.status) ?
                      <button className="small-action" onClick={() => submitBatch(b.id)}>{b.status === "RETURNED" ? "Resubmit" : "Submit"}</button> :
                      role === "TRAINING_CENTER" && firstCertificate ?
                        <div className="cell-actions">
                          <button className="small-action" onClick={() => downloadCertificate(firstCertificate.id)}>PDF</button>
                          {firstCertificate.deliveries?.[0] && (
                            <button className="secondary-button tiny" onClick={() => retryDelivery(firstCertificate.deliveries[0].id)}>
                              {firstCertificate.deliveries[0].status === "FAILED" ? "Retry" : "Redeliver"}
                            </button>
                          )}
                        </div> : "—"}</td>
                  </tr>;
                })}</tbody>
              </table></div>
            }
          </div>

          {showCreate && <div className="modal-backdrop"><div className="modal">
            <div className="modal-header"><h3>Create Batch</h3><button onClick={() => setShowCreate(false)}><X/></button></div>
            <form onSubmit={createBatch} className="modal-form">
              <label>Batch Number<input required value={batchNumber} onChange={e => setBatchNumber(e.target.value)} placeholder="BATCH-001"/></label>
              <label>Course Name<input required value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="Full Stack Development"/></label>
              <label>District<input required value={district} onChange={e => setDistrict(e.target.value)}/></label>
              <label>Candidates <small>One per line: ID, Name, Phone, Email</small>
                <textarea rows={5} required value={candidateText} onChange={e => setCandidateText(e.target.value)}/>
              </label>
              <button className="primary-button full-button" type="submit">Create Batch</button>
            </form>
          </div></div>}

          {showCSV && <div className="modal-backdrop"><div className="modal">
            <div className="modal-header"><h3>Upload CSV Batch</h3><button onClick={() => setShowCSV(false)}><X/></button></div>
            <form onSubmit={uploadCSV} className="modal-form">
              <label>Batch Number<input required value={csvBatchNumber} onChange={e => setCsvBatchNumber(e.target.value)}/></label>
              <label>Course Name<input required value={csvCourse} onChange={e => setCsvCourse(e.target.value)}/></label>
              <label>District<input required value={csvDistrict} onChange={e => setCsvDistrict(e.target.value)}/></label>
              <label>CSV File<input type="file" accept=".csv" required onChange={e => setCsvFile(e.target.files?.[0] || null)}/></label>
              <button className="primary-button full-button" type="submit">Upload CSV</button>
            </form>
          </div></div>}
        </div>
      </main>
    </div>
  );
}

function DistrictReviewPanel() {
  const [batches, setBatches] = useState<any[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadBatches = async () => {
    setLoading(true);
    setError("");
    try {
      const [pending, reviews] = await Promise.all([
        api.get("/batches/pending"),
        api.get("/batches/my-reviews"),
      ]);
      setBatches(pending.data);
      setHistory(reviews.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load district review data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBatches(); }, []);

  const reviewBatch = async (
    batchId: string,
    decision: "APPROVED" | "RETURNED" | "REJECTED"
  ) => {
    if (decision !== "APPROVED" && !comments[batchId]?.trim()) {
      setError("Please add a comment when returning or rejecting a batch.");
      return;
    }
    setProcessing((prev) => ({ ...prev, [batchId]: true }));
    setMessage("");
    setError("");
    try {
      const { data } = await api.post(`/batches/${batchId}/review`, {
        decision,
        comment: comments[batchId] || "",
      });
      setMessage(
        data.status === "STATE_REVIEW"
          ? "Approved. The batch now moves to State Admin review."
          : `Batch ${decision.toLowerCase()} successfully.`
      );
      await loadBatches();
    } catch (err: any) {
      setError(err.response?.data?.message || "Review failed");
    } finally {
      setProcessing((prev) => ({ ...prev, [batchId]: false }));
    }
  };

  if (loading) return <p>Loading pending batches...</p>;

  return (
    <div className="review-panel">
      <h2>Pending District Reviews</h2>
      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      {batches.length === 0 ? <p>No batches awaiting your review.</p> : batches.map((batch) => (
        <div className="review-card" key={batch.id}>
          <div className="review-card-header">
            <div><h3>{batch.batchNumber}</h3><p>{batch.courseName}</p></div>
            <span className="status-badge">{batch.status?.replaceAll("_", " ")}</span>
          </div>
          <p><strong>District:</strong> {batch.district}</p>
          <p><strong>Candidates:</strong> {batch.candidates?.length ?? batch.candidateCount ?? 0}</p>
          <p><strong>District approvals:</strong>{" "}
            {batch.approvals?.filter((a: any) => a.decision === "APPROVED" && a.reviewCycle === batch.reviewCycle).length ?? 0}/2
          </p>
          <textarea
            placeholder="Required for return or rejection"
            value={comments[batch.id] || ""}
            onChange={(e) => setComments((prev) => ({ ...prev, [batch.id]: e.target.value }))}
          />
          <div className="review-actions">
            <button className="approve-btn" disabled={processing[batch.id]} onClick={() => reviewBatch(batch.id, "APPROVED")}>
              {processing[batch.id] ? "Processing..." : "Approve"}
            </button>
            <button className="return-btn" disabled={processing[batch.id]} onClick={() => reviewBatch(batch.id, "RETURNED")}>Return</button>
            <button className="reject-btn" disabled={processing[batch.id]} onClick={() => reviewBatch(batch.id, "REJECTED")}>Reject</button>
          </div>
        </div>
      ))}
      {history.length > 0 && (
        <div className="history-panel">
          <h3>My Review History</h3>
          <div className="table-scroll">
            <table className="batch-table">
              <thead><tr><th>Batch</th><th>Decision</th><th>Cycle</th><th>Comment</th><th>Reviewed</th></tr></thead>
              <tbody>{history.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.batch.batchNumber}</strong></td>
                  <td><span className={`status status-${item.decision}`}>{item.decision}</span></td>
                  <td>{item.reviewCycle}</td>
                  <td>{item.comment || "—"}</td>
                  <td>{new Date(item.reviewedAt).toLocaleDateString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StateAdminPanel() {
  const [batches, setBatches] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [revokeId, setRevokeId] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [batchRes, certRes] = await Promise.all([
        api.get("/batches/state-pending"),
        api.get("/certificates"),
      ]);
      setBatches(batchRes.data);
      setCertificates(certRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load State Admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (batchId: string) => {
    setProcessing((prev) => ({ ...prev, [batchId]: true }));
    setMessage("");
    setError("");
    try {
      await api.post(`/batches/${batchId}/state-approve`);
      setMessage("Final approval complete. Certificates have been issued.");
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || "State approval failed");
    } finally {
      setProcessing((prev) => ({ ...prev, [batchId]: false }));
    }
  };

  const revoke = async (certificateId: string) => {
    if (!reason.trim()) {
      setError("A revocation reason is required.");
      return;
    }
    setProcessing((prev) => ({ ...prev, [certificateId]: true }));
    setError("");
    try {
      await api.post(`/certificates/${certificateId}/revoke`, { reason });
      setMessage("Certificate revoked successfully.");
      setRevokeId("");
      setReason("");
      await load();
    } catch (err: any) {
      setError(err.response?.data?.message || "Revocation failed");
    } finally {
      setProcessing((prev) => ({ ...prev, [certificateId]: false }));
    }
  };

  const downloadPdf = async (certificateId: string) => {
    try {
      const res = await api.get(`/certificates/${certificateId}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(res.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "certificate.pdf";
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.message || "Certificate download failed");
    }
  };

  if (loading) return <p>Loading State Admin workspace...</p>;

  return (
    <div className="review-panel">
      <h2>State Approval Queue</h2>
      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      {batches.length === 0 ? <p>No batches are pending State approval.</p> : batches.map((batch) => (
        <div className="review-card" key={batch.id}>
          <div className="review-card-header">
            <div><h3>{batch.batchNumber}</h3><p>{batch.courseName}</p></div>
            <span className="status-badge">STATE REVIEW</span>
          </div>
          <p><strong>Training Centre:</strong> {batch.center?.name}</p>
          <p><strong>District:</strong> {batch.district}</p>
          <p><strong>Candidates:</strong> {batch.candidates?.length ?? 0}</p>
          <div className="approval-history">
            {batch.approvals?.map((approval: any) => (
              <span className="approval-chip" key={approval.id}>
                {approval.reviewer?.name}: APPROVED
              </span>
            ))}
          </div>
          <button className="approve-btn" disabled={processing[batch.id]} onClick={() => approve(batch.id)}>
            {processing[batch.id] ? "Processing..." : "Give Final Approval"}
          </button>
        </div>
      ))}

      <div className="history-panel">
        <h3>Certificates</h3>
        {certificates.length === 0 ? <p>No certificates issued.</p> : (
          <div className="table-scroll">
            <table className="batch-table">
              <thead><tr><th>Candidate</th><th>Certificate</th><th>Course</th><th>Status</th><th>Delivery</th><th>Action</th></tr></thead>
              <tbody>{certificates.map((certificate) => (
                <tr key={certificate.id}>
                  <td>{certificate.candidate.fullName}</td>
                  <td><strong>{certificate.certificateNumber}</strong></td>
                  <td>{certificate.candidate.batch.courseName}</td>
                  <td><span className={`status ${certificate.revokedAt ? "status-REVOKED" : "status-APPROVED"}`}>{certificate.revokedAt ? "REVOKED" : "ACTIVE"}</span></td>
                  <td>{certificate.deliveries?.[0]?.status || "PENDING"}</td>
                  <td className="cell-actions">
                    <button className="small-action" onClick={() => downloadPdf(certificate.id)}>PDF</button>
                    {!certificate.revokedAt && <button className="reject-btn small-action" onClick={() => setRevokeId(certificate.id)}>Revoke</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {revokeId && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header"><h3>Revoke Certificate</h3><button onClick={() => setRevokeId("")}><X /></button></div>
            <form className="modal-form" onSubmit={(e) => { e.preventDefault(); revoke(revokeId); }}>
              <label>Revocation reason<textarea required rows={4} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
              <button className="reject-btn full-button" type="submit" disabled={processing[revokeId]}>
                {processing[revokeId] ? "Revoking..." : "Confirm Revocation"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PublicVerification() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError("");
    setData(null);
    axios.get(`${API}/certificates/verify/${token}`)
      .then((res) => setData(res.data))
      .catch((err) => {
        setError(
          err.response?.status === 404
            ? "This verification link is invalid or the certificate could not be found."
            : err.response?.data?.message || "Unable to verify the certificate. Please try again."
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  const downloadPdf = async () => {
    if (!token) return;
    setDownloading(true);
    setError("");
    try {
      const response = await axios.get(
        `${API}/certificates/verify/${token}/pdf`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${data?.certificateNumber || "certificate"}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.message || "Unable to download the certificate PDF.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="verify-page">
        <div className="verify-loading" role="status">
          <RefreshCw className="verify-spinner" />
          <p>Verifying certificate...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-page">
      <div className="verify-card">
        <div className="verify-brand"><ShieldCheck /> CertiFlow Public Verification</div>
        {error ? (
          <div className="verify-error">
            <h1 className="verify-invalid">Unable to Verify</h1>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div className={`verify-status ${data?.status === "REVOKED" ? "revoked" : "valid"}`}>
              {data?.status === "REVOKED" ? "REVOKED" : "VALID"}
            </div>
            <h1 className={data?.status === "REVOKED" ? "verify-revoked" : "verify-valid"}>
              {data?.status === "REVOKED" ? "Certificate Revoked" : "Certificate Verified"}
            </h1>
            <dl className="verify-details">
              <dt>Candidate</dt><dd>{data.candidateName}</dd>
              <dt>Certificate ID</dt><dd>{data.certificateNumber}</dd>
              <dt>Course</dt><dd>{data.courseName}</dd>
              <dt>Issuing institution</dt><dd>{data.issuingInstitution || "—"}</dd>
              <dt>Issue date</dt><dd>{new Date(data.issuedAt).toLocaleDateString()}</dd>
              {data.status === "REVOKED" && <>
                <dt>Revoked at</dt><dd>{new Date(data.revokedAt).toLocaleDateString()}</dd>
                <dt>Reason</dt><dd>{data.revocationReason}</dd>
              </>}
            </dl>
            <div className="verify-actions">
              <a
                className="primary-button"
                href={`${API}/certificates/verify/${token}/pdf`}
                target="_blank"
                rel="noreferrer"
              >
                View PDF
              </a>
              <button className="secondary-button" onClick={downloadPdf} disabled={downloading}>
                {downloading ? "Downloading..." : "Download PDF"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return <Routes>
    <Route path="/" element={<Login/>}/>
    <Route path="/dashboard" element={<Dashboard/>}/>
    <Route path="/verify/:token" element={<PublicVerification/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
