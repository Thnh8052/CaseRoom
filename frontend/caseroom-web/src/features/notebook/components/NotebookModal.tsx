import React, { useState, useRef, useEffect } from "react";
import type { Clue, Player } from "../../../shared/types/game";
import "../styles/NotebookModal.css";

type NotebookModalProps = {
  clues: Clue[];
  role: string;
  onClose: () => void;
  streamAskDetectiveAi?: (question: string) => AsyncIterable<string>;
  tamperClue?: (clueId: string, fakeText: string) => Promise<void>;
  visiblePlayers?: Player[];
  shareClue?: (targetPlayerId: string, clueId: string) => Promise<void>;
};

export function NotebookModal({ clues, role, onClose, streamAskDetectiveAi, tamperClue, visiblePlayers = [], shareClue }: NotebookModalProps) {
  const [activeTab, setActiveTab] = useState<'clues' | 'ai'>('clues');
  
  // Tamper State
  const [editingClueId, setEditingClueId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isTampering, setIsTampering] = useState(false);

  // AI Chat State
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === 'ai' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatLog, activeTab]);

  const handleAsk = async () => {
    if (!inputValue.trim() || !streamAskDetectiveAi || isAsking) return;

    const question = inputValue.trim();
    setInputValue("");
    setChatLog(prev => [...prev, { role: 'user', content: question }, { role: 'ai', content: '' }]);
    setIsAsking(true);

    try {
      const stream = streamAskDetectiveAi(question);
      for await (const chunk of stream) {
        setChatLog(prev => {
          const newLog = [...prev];
          const lastMsg = newLog[newLog.length - 1];
          if (lastMsg && lastMsg.role === 'ai') {
            newLog[newLog.length - 1] = { ...lastMsg, content: lastMsg.content + chunk };
          }
          return newLog;
        });
      }
    } catch (err) {
      setChatLog(prev => {
        const newLog = [...prev];
        const lastMsg = newLog[newLog.length - 1];
        if (lastMsg && lastMsg.role === 'ai') {
          newLog[newLog.length - 1] = { ...lastMsg, content: lastMsg.content + "\n[Lỗi kết nối tới AI]" };
        }
        return newLog;
      });
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass-panel notebook-modal-container"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="notebook-modal-header">
          <h2 className="notebook-modal-title">
            <span>📓</span> Sổ Tay & Trợ Lý
          </h2>
          <button
            onClick={onClose}
            className="notebook-close-btn"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="notebook-tabs">
          <button
            className={`notebook-tab-btn ${activeTab === 'clues' ? 'active' : ''}`}
            onClick={() => setActiveTab('clues')}
          >
            🔍 Manh mối thu thập
          </button>
          <button
            className={`notebook-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            🤖 Trợ lý AI (DeepSeek)
          </button>
        </div>

        {/* Content */}
        <div className="notebook-content">
          {activeTab === 'clues' && (
            clues.length === 0 ? (
              <div className="notebook-empty-state">
                <p className="notebook-empty-icon">🕵️</p>
                <p>Sổ tay của bạn hiện đang trống rỗng.</p>
                <p className="notebook-empty-text">Hãy khám xét các đồ vật trong phòng để thu thập manh mối!</p>
              </div>
            ) : (
              <div className="clue-list">
                {clues.map((clue, idx) => (
                  <div key={clue.id} className="clue-card">
                    <div className="clue-badge">
                      Manh mối #{idx + 1}
                    </div>
                    <h3 className="clue-title">
                      {clue.title}
                    </h3>
                    
                    {editingClueId === clue.id ? (
                      <div className="clue-tamper-container">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          disabled={isTampering}
                          className="clue-tamper-textarea"
                        />
                        <div className="clue-tamper-actions">
                          <button 
                            disabled={isTampering}
                            onClick={async () => {
                              if (tamperClue) {
                                setIsTampering(true);
                                // Fake time penalty on UI
                                await new Promise(r => setTimeout(r, 2000));
                                await tamperClue(clue.id, editValue);
                                setIsTampering(false);
                                setEditingClueId(null);
                              }
                            }}
                            className="btn-tamper-save">
                            {isTampering ? 'Đang sửa...' : 'Lưu lại'}
                          </button>
                          <button 
                            disabled={isTampering}
                            onClick={() => setEditingClueId(null)}
                            className="btn-tamper-cancel">
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className={`clue-description ${clue.fakeDescription ? 'tampered' : ''}`}>
                          {clue.description}
                        </p>
                        {clue.fakeDescription && (
                          <p className="clue-fake-description">
                            Giả mạo: {clue.fakeDescription}
                          </p>
                        )}
                        <div className="clue-footer">
                          <div className="clue-source">
                            Thu thập từ: <strong>{clue.sourceObjectId}</strong>
                          </div>
                          {role === "Murderer" && clue.isTamperable && clue.tamperCount < clue.maxTamperLimit && (
                            <button
                              onClick={() => {
                                setEditingClueId(clue.id);
                                setEditValue(clue.fakeDescription || clue.description);
                              }}
                              className="btn-tamper-trigger"
                            >
                              ✏️ Làm giả ({clue.maxTamperLimit - clue.tamperCount} lần)
                            </button>
                          )}
                          {visiblePlayers.length > 0 && shareClue && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  shareClue(e.target.value, clue.id);
                                  e.target.value = "";
                                }
                              }}
                              style={{
                                marginLeft: 8,
                                padding: "4px 8px",
                                borderRadius: 4,
                                background: "rgba(255,255,255,0.1)",
                                border: "1px solid rgba(255,255,255,0.2)",
                                color: "#fff",
                                fontSize: "0.8rem"
                              }}
                            >
                              <option value="">Chia sẻ với...</option>
                              {visiblePlayers.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'ai' && (
            <div className="ai-tab-container">
              {/* Chat Log */}
              <div className="ai-chat-log">
                {chatLog.length === 0 && (
                  <div className="ai-chat-empty">
                    <p>Hãy hỏi Trợ lý AI bất cứ điều gì về vụ án này.</p>
                    <p className="ai-chat-empty-text">AI sẽ dựa trên các manh mối bạn đã có để gợi ý.</p>
                  </div>
                )}
                {chatLog.map((msg, idx) => (
                  <div key={idx} className={`ai-chat-message ${msg.role}`}>
                    {msg.content}
                    {msg.role === 'ai' && msg.content === '' && isAsking && idx === chatLog.length - 1 && (
                      <span className="ai-chat-thinking"> Đang suy nghĩ...</span>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="ai-chat-input-container">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAsk(); }}
                  disabled={isAsking}
                  placeholder="Nhập câu hỏi cho trợ lý AI..."
                  className="ai-chat-input"
                />
                <button
                  onClick={handleAsk}
                  disabled={isAsking || !inputValue.trim()}
                  className={`ai-chat-submit ${(!isAsking && inputValue.trim()) ? 'ready' : 'disabled'}`}
                >
                  {isAsking ? '...' : 'Gửi'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
