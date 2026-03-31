import React from 'react';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, Volume2, Moon, Sun, Monitor, Sparkles, X, Activity } from 'lucide-react';
import { AppSettings, GameStatus } from '../types';

interface SettingsProps {
  key?: string;
  settings: AppSettings;
  onUpdate: (newSettings: Partial<AppSettings>) => void;
  onClose: () => void;
}

export default function Settings({ settings, onUpdate, onClose }: SettingsProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="min-h-screen flex flex-col items-center justify-center p-6 relative z-10 w-full"
    >
      <div className="w-full max-w-2xl bg-panel rounded-[3rem] border border-panel-border backdrop-blur-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-panel-border flex items-center justify-between relative">
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 bg-accent/20 text-accent rounded-2xl flex items-center justify-center shadow-inner">
              <SettingsIcon size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-serif font-bold text-text">CONFIGURACIÓN</h2>
              <p className="text-text-muted text-xs uppercase tracking-widest mt-1">Ajusta tu experiencia</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-12 h-12 rounded-full border border-panel-border flex items-center justify-center text-text-muted hover:bg-danger/20 hover:text-danger hover:border-danger/30 transition-all z-10"
          >
            <X size={24} />
          </button>
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-10">
          
          {/* Theme Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-text">
              <Moon size={20} className="text-purple" />
              <h3 className="font-bold uppercase tracking-wider">Aspecto Visual</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <ThemeButton 
                active={settings.theme === 'dark'} 
                onClick={() => onUpdate({ theme: 'dark' })}
                icon={<Moon size={18} />}
                label="OSCURO"
                desc="El original"
              />
              <ThemeButton 
                active={settings.theme === 'light'} 
                onClick={() => onUpdate({ theme: 'light' })}
                icon={<Sun size={18} />}
                label="CLARO"
                desc="Día Soleado"
              />
              <ThemeButton 
                active={settings.theme === 'high-contrast'} 
                onClick={() => onUpdate({ theme: 'high-contrast' })}
                icon={<Activity size={18} />}
                label="CONTRASTE"
                desc="Máxima visibilidad"
              />
            </div>
          </section>

          {/* Audio Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 text-text">
              <Volume2 size={20} className="text-teal" />
              <h3 className="font-bold uppercase tracking-wider">Sonido ambiental</h3>
            </div>
            
            <div className="space-y-6 bg-panel-hover p-6 rounded-2xl border border-panel-border">
              <VolumeSlider 
                label="VOLUMEN MÚSICA" 
                value={settings.masterVolume} 
                onChange={(v) => onUpdate({ masterVolume: v })} 
              />
              <VolumeSlider 
                label="EFECTOS (SFX)" 
                value={settings.sfxVolume} 
                onChange={(v) => onUpdate({ sfxVolume: v })} 
              />
            </div>
          </section>

          {/* Performance Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-text">
              <Monitor size={20} className="text-gold" />
              <h3 className="font-bold uppercase tracking-wider">Rendimiento</h3>
            </div>
            
            <button
              onClick={() => onUpdate({ particlesEnabled: !settings.particlesEnabled })}
              className={`w-full p-4 rounded-2xl border transition-all flex items-center justify-between ${
                settings.particlesEnabled 
                ? 'bg-accent/10 border-accent/30 text-text' 
                : 'bg-panel border-panel-border text-text-muted'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings.particlesEnabled ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'bg-black/20 text-text-muted'}`}>
                  <Sparkles size={18} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-sm tracking-wide">EFECTOS DE PARTÍCULAS</div>
                  <div className="text-xs opacity-70">Desactiva para mejorar el rendimiento en dispositivos lentos</div>
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.particlesEnabled ? 'bg-accent' : 'bg-gray-700'}`}>
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.particlesEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
            </button>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

function ThemeButton({ active, onClick, icon, label, desc }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, desc: string }) {
  return (
    <button 
      onClick={onClick}
      className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all group ${
        active 
        ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20 scale-[1.02]' 
        : 'bg-panel border-panel-border text-text hover:bg-panel-hover'
      }`}
    >
      <div className={`${active ? 'text-white' : 'text-text-muted group-hover:text-accent'} transition-colors`}>
        {icon}
      </div>
      <div className="text-center">
        <div className="font-bold text-xs tracking-wider">{label}</div>
        <div className={`text-[9px] uppercase tracking-widest mt-1 ${active ? 'text-white/80' : 'text-text-muted'}`}>{desc}</div>
      </div>
    </button>
  );
}

function VolumeSlider({ label, value, onChange }: { label: string, value: number, onChange: (v: number) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-xs font-bold tracking-widest text-text">
        <span>{label}</span>
        <span className="text-accent">{value}%</span>
      </div>
      <input 
        type="range" 
        min="0" 
        max="100" 
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-black/40 rounded-full appearance-none cursor-pointer accent-accent"
      />
    </div>
  );
}
