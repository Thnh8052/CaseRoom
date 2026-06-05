import { useState } from "react";
import type { CharacterAppearance } from "../../../shared/types/game";

import "../styles/character-setup.css";

type Props = {
  initialAppearance?: CharacterAppearance;
  onSave: (appearance: CharacterAppearance) => void;
  onClose: () => void;
};

const COLORS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Red", value: "#ef4444" },
  { label: "Green", value: "#22c55e" },
  { label: "Purple", value: "#a855f7" },
  { label: "Orange", value: "#f97316" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Yellow", value: "#eab308" }
];

const OUTFITS = ["Casual", "Suit", "Uniform"];
const HAIRS = ["Black", "Blonde", "Brown"];
const ACCESSORIES = ["None", "Glasses", "Hat"];
const HEIGHTS = ["Short", "Medium", "Tall"];
const RACES = ["Human", "Asian", "Caucasian", "African", "Hispanic", "Alien"];

export function CharacterSetupModal({ initialAppearance, onSave, onClose }: Props) {
  const [color, setColor] = useState(initialAppearance?.avatarColor || COLORS[0].value);
  const [outfit, setOutfit] = useState(initialAppearance?.outfitColor || OUTFITS[0]);
  const [hair, setHair] = useState(initialAppearance?.hairColor || HAIRS[0]);
  const [accessory, setAccessory] = useState(initialAppearance?.accessory || ACCESSORIES[0]);
  const [height, setHeight] = useState(initialAppearance?.height || HEIGHTS[1]);
  const [race, setRace] = useState(initialAppearance?.race || RACES[0]);

  const handleSave = () => {
    onSave({
      avatarColor: color,
      outfitColor: outfit,
      hairColor: hair,
      accessory: accessory,
      height: height,
      race: race
    });
    onClose();
  };

  return (
    <div className="setup-overlay">
      <div className="glass-panel setup-modal">
        <div className="lobby-header" style={{ marginBottom: 24 }}>
          <h2>Character Setup</h2>
          <button onClick={onClose} className="setup-close-btn">✕</button>
        </div>

        <div className="setup-section">
          <label className="setup-label">Avatar Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="setup-color-circle" style={{ backgroundColor: color, flexShrink: 0, width: 24, height: 24 }} />
            <select className="setup-select" value={color} onChange={e => setColor(e.target.value)}>
              {COLORS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="setup-section" style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label className="setup-label">Race</label>
            <select className="setup-select" value={race} onChange={e => setRace(e.target.value)}>
              {RACES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="setup-label">Height</label>
            <select className="setup-select" value={height} onChange={e => setHeight(e.target.value)}>
              {HEIGHTS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div className="setup-section" style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <label className="setup-label">Outfit</label>
            <select className="setup-select" value={outfit} onChange={e => setOutfit(e.target.value)}>
              {OUTFITS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label className="setup-label">Hair Color</label>
            <select className="setup-select" value={hair} onChange={e => setHair(e.target.value)}>
              {HAIRS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <div className="setup-section">
          <label className="setup-label">Accessory</label>
          <select className="setup-select" value={accessory} onChange={e => setAccessory(e.target.value)}>
            {ACCESSORIES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <button className="btn-primary-large" onClick={handleSave} style={{ marginTop: 32 }}>
          Save Appearance
        </button>
      </div>
    </div>
  );
}
