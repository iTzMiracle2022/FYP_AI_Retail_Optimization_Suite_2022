import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '../components/common/Navbar';
import ErrorMessage from '../components/common/ErrorMessage';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { uploadDataset, listDatasets, deleteDataset } from '../api/datasetAPI';
import { Upload, FileText, Trash2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from "../context/AuthContext";

const DatasetUpload = () => {
  const { user } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const fileInputRef = useRef(null);

  console.log("DatasetUpload component is rendering! Current datasets length:", datasets?.length);

  const refreshList = useCallback(async () => {
    if (!user?.email) return;
    setLoadingList(true);
    try {
      const res = await listDatasets(user.email);
      setDatasets(res.datasets || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingList(false);
    }
  }, [user?.email]);

  useEffect(() => { refreshList(); }, [refreshList]);

  const handleUpload = async (file) => {
    if (!file) return;
    if (!user?.email) return setError("User identity not confirmed.");

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      return setError('Only CSV or Excel files are supported.');
    }

    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      const res = await uploadDataset(file, user.email);
      setSuccess({
        message: res.message,
        datasetId: res.dataset_id,
        rows: res.rows,
        columns: res.columns,
        type: res.dataset_type
      });
      await refreshList();
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => handleUpload(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleUpload(e.dataTransfer.files[0]);
  };

  const handleDelete = async (datasetId) => {
    console.log("handleDelete called for datasetId:", datasetId);
    // if (!window.confirm(`Delete dataset "${datasetId}"?`)) return;
    if (!user?.email) {
      console.log("User email missing!");
      return setError("User identity not confirmed.");
    }

    try {
      console.log("Calling deleteDataset API...");
      const res = await deleteDataset(datasetId, user.email);
      console.log("API response:", res);
      await refreshList();
      console.log("List refreshed!");
    } catch (err) {
      console.error("Delete Error:", err);
      setError(err);
    }
  };

  return (
    <div className="dashboard-content-fade-in">
      <Navbar title="Data Hub" />

      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>

      {/* ── Drag & Drop Zone */}
      <div
        className="premium-card"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? '#2563EB' : '#E5E7EB'}`,
          textAlign: 'center',
          padding: '2.5rem 2rem',
          cursor: 'pointer',
          marginBottom: '2rem',
          background: dragging ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-secondary)',
          borderRadius: '16px',
          transition: 'all 0.4s ease',
          position: 'relative',
          overflow: 'hidden'
        }}
        onClick={() => fileInputRef.current.click()}
      >
        <div className="glow-overlay" style={{ opacity: dragging ? 0.3 : 0.1 }}></div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div style={{ display: 'inline-flex', padding: '1rem', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '16px', marginBottom: '1rem' }}>
          <Upload size={32} style={{ color: '#2563EB' }} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', fontFamily: "'Manrope', sans-serif" }}>
          {dragging ? 'Drop to Upload' : 'Upload Your Records'}
        </h3>
        <p style={{ color: '#64748B', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
          Drag and drop your CSV or Excel files here. Our AI will automatically detect if it's Sales, Inventory, or Customer data.
        </p>
        <button className="cta-button" style={{ padding: '0.85rem 2.5rem' }}>
          Browse Files
        </button>
      </div>

      {/* ── Status messages */}
      {uploading && <LoadingSpinner message="Securely uploading and processing your dataset..." />}
      <ErrorMessage message={error} />

      {success && (
        <div style={{
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          borderLeft: '4px solid #10B981',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          color: '#064E3B',
          boxShadow: '0 2px 10px rgba(16, 185, 129, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <CheckCircle2 color="#10B981" size={22} />
            <strong style={{ fontSize: '1.05rem' }}>{success.message}</strong>
          </div>
          <div style={{ display: 'flex', gap: '2rem', fontSize: '0.9rem', flexWrap: 'wrap', fontWeight: 500 }}>
            <span>🆔 ID: <code style={{ backgroundColor: '#D1FAE5', color: '#047857', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 700 }}>{success.datasetId}</code></span>
            <span>📊 Rows: <strong>{success.rows?.toLocaleString()}</strong></span>
            <span>🔖 Type: <strong style={{ textTransform: 'capitalize' }}>{success.type}</strong></span>
            <span>📋 Columns: <strong>{success.columns?.length}</strong></span>
          </div>
          {success.columns && (
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#047857', lineHeight: 1.5 }}>
              <strong>Columns:</strong> {success.columns.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* ── Registered Datasets Table */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: 0, overflow: 'hidden', boxShadow: 'var(--glass-shadow)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: "'Manrope', sans-serif", margin: 0 }}>
            Registered Datasets
          </h3>
          <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>{datasets.length} dataset(s)</span>
        </div>

        {loadingList ? (
          <LoadingSpinner message="Loading datasets..." />
        ) : datasets.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94A3B8' }}>
            <FileText size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>No datasets uploaded yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', borderSpacing: 0 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                {['Dataset ID', 'File Name', 'Type', 'Upload Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E5E7EB' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datasets.map((d, i) => (
                <tr key={d.dataset_id} style={{ borderBottom: '1px solid #E5E7EB', transition: 'background 0.2s', backgroundColor: 'white' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <td style={{ padding: '1rem 1.5rem' }}><code style={{ fontSize: '0.8rem', color: '#3B82F6', fontWeight: 600, backgroundColor: 'var(--bg-secondary)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{d.dataset_id}</code></td>
                  <td style={{ padding: '1rem 1.5rem', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem' }}>{d.file_name}</td>
                  <td style={{ padding: '1rem 1.5rem' }}><span style={{ backgroundColor: 'var(--bg-secondary)', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>{d.file_type?.toUpperCase()}</span></td>
                  <td style={{ padding: '1rem 1.5rem', color: '#64748B', fontSize: '0.85rem', fontWeight: 500 }}>
                    {d.upload_date ? new Date(d.upload_date).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <button
                      onClick={() => handleDelete(d.dataset_id)}
                      style={{ background: 'var(--danger-bg)', border: '1px solid #FECACA', color: '#DC2626', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', transition: 'all 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#FEE2E2'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'var(--danger-bg)'}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DatasetUpload;
