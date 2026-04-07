import React, { useState, useEffect, useCallback, Component, ReactNode } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { 
  LayoutDashboard, 
  Plus, 
  Settings, 
  TrendingUp, 
  DollarSign, 
  MessageSquare, 
  AlertTriangle,
  Zap,
  ArrowRight,
  ChevronRight,
  FileCode,
  Layers,
  Activity,
  Search,
  Filter,
  MoreVertical,
  Trash2,
  Edit2,
  Download,
  Upload,
  Play,
  Menu,
  X,
  Loader2
} from 'lucide-react';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { 
  Project, 
  Integration, 
  SimulationResult, 
  Recommendation, 
  IntegrationGroup, 
  SimulationHistoryItem 
} from './types';
import { getOptimizationRecommendations } from './services/aiService';
import { cn } from './lib/utils';

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: ReactNode;
  name: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState;
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
    this.props = props;
  }

  static getDerivedStateFromError(_: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error(`Error in ${this.props.name}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-red-900 mb-2">Something went wrong in {this.props.name}</h3>
          <p className="text-red-600 mb-6">We encountered an unexpected error. Please try refreshing the page or contact support.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

const Sidebar = ({ activeTab, setActiveTab, isOpen, onClose, onSimulatorClick }: { activeTab: string, setActiveTab: (t: string) => void, isOpen: boolean, onClose: () => void, onSimulatorClick: () => void }) => {
  const { t, i18n } = useTranslation();
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('Overview') },
    { id: 'projects', icon: Layers, label: t('Projects') },
    { id: 'simulator', icon: Play, label: t('Cost Simulator'), action: onSimulatorClick },
    { id: 'analyzer', icon: FileCode, label: t('Flow Analyzer') },
    { id: 'settings', icon: Settings, label: t('Settings') },
  ];

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'es' : 'en';
    i18n.changeLanguage(nextLang);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={cn(
        "fixed inset-y-0 left-0 w-64 bg-[#151619] text-white h-screen flex flex-col border-r border-white/5 z-50 transition-transform duration-300 lg:relative lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-lg tracking-tight">SAP FinOps</span>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'simulator' && onSimulatorClick) onSimulatorClick();
                setActiveTab(item.id);
                onClose();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                activeTab === item.id 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300")} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto space-y-4">
          <button 
            onClick={toggleLanguage}
            className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/50 rounded-xl border border-white/5 text-zinc-400 hover:text-white transition-all"
          >
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5" />
              <span className="font-medium text-sm">{t('Language')}</span>
            </div>
            <span className="text-xs font-bold text-emerald-400 uppercase">{i18n.language === 'en' ? 'EN' : 'ES'}</span>
          </button>

          <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">System Status</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Connected to SAP BTP Simulation Engine v2.4
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

const StatCard = ({ label, value, subValue, icon: Icon, color, trend, trendLabel, projectValue, tooltip, trendData, dataKey }: any) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={cn("p-3 rounded-2xl", color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center gap-2">
          {tooltip && (
            <div className="group/tooltip relative">
              <div className="p-1 text-zinc-300 hover:text-zinc-500 cursor-help">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-900 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 shadow-xl text-center">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-zinc-900" />
              </div>
            </div>
          )}
          {trend !== undefined && trend !== 0 && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold shrink-0",
              trend > 0 ? "text-red-600 bg-red-50" : "text-emerald-600 bg-emerald-50"
            )}>
              {trend > 0 ? <AlertTriangle className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {Math.abs(trend)}% {trendLabel}
            </div>
          )}
        </div>
      </div>
      
      <div className="relative z-10">
        <h3 className="text-zinc-500 text-sm font-medium mb-1 truncate">{label}</h3>
        <div className="flex items-baseline gap-2 flex-wrap mb-2">
          <span className="text-2xl md:text-3xl font-bold text-zinc-900 break-all">{value}</span>
          <span className="text-zinc-400 text-xs md:text-sm truncate">{subValue}</span>
        </div>
      </div>

      {trendData && (
        <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30 group-hover:opacity-50 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <Area 
                type="monotone" 
                dataKey={dataKey} 
                stroke={color.includes('emerald') ? '#10b981' : color.includes('blue') ? '#3b82f6' : '#8b5cf6'} 
                fill={color.includes('emerald') ? '#10b981' : color.includes('blue') ? '#3b82f6' : '#8b5cf6'} 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {projectValue && (
        <div className="pt-3 border-t border-zinc-50 flex items-center justify-between relative z-10 bg-white/80 backdrop-blur-sm">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('Project Goal')}</span>
          <span className="text-[10px] font-bold text-zinc-600">{projectValue}</span>
        </div>
      )}
    </div>
  );
};

const IntegrationDesigner = ({ onSimulate, initialData, project, isSimulating }: { onSimulate: (data: any) => void, initialData?: any, project: Project | null, isSimulating: boolean }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialData?.name || t('New Integration'));
  const [payloadSize, setPayloadSize] = useState(initialData?.base_payload_size || 50);
  const [dailyVolume, setDailyVolume] = useState(initialData?.daily_volume || 5000);
  const [retries, setRetries] = useState(initialData?.retries || 0);
  const [failureRate, setFailureRate] = useState(initialData?.failure_rate || 5);
  const [groupId, setGroupId] = useState<number | null>(initialData?.group_id || null);
  const [groups, setGroups] = useState<IntegrationGroup[]>([]);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDefaultRetries, setNewGroupDefaultRetries] = useState(0);
  const getInitialSteps = () => {
    if (!initialData?.config) return [
      { id: '1', type: 'start', name: 'Source System' },
      { id: '2', type: 'mapping', name: 'Transform' },
      { id: '3', type: 'end', name: 'Target System' },
    ];
    let config = initialData.config;
    if (typeof config === 'string') {
      try {
        config = JSON.parse(config);
      } catch (e) {
        return [
          { id: '1', type: 'start', name: 'Source System' },
          { id: '2', type: 'mapping', name: 'Transform' },
          { id: '3', type: 'end', name: 'Target System' },
        ];
      }
    }
    return config.steps || [
      { id: '1', type: 'start', name: 'Source System' },
      { id: '2', type: 'mapping', name: 'Transform' },
      { id: '3', type: 'end', name: 'Target System' },
    ];
  };

  const [steps, setSteps] = useState<any[]>(getInitialSteps());

  const selectedGroup = groups.find(g => g.id === groupId);

  useEffect(() => {
    if (project) {
      fetch(`/api/projects/${project.id}/groups`)
        .then(res => res.json())
        .then(data => setGroups(data));
    }
  }, [project]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPayloadSize(initialData.base_payload_size);
      setDailyVolume(initialData.daily_volume);
      setRetries(initialData.retries);
      setFailureRate(initialData.failure_rate || 5);
      setGroupId(initialData.group_id || null);
      setSteps(initialData.config?.steps || []);
    }
  }, [initialData]);

  const handleCreateGroup = async () => {
    if (!project || !newGroupName) return;
    const res = await fetch(`/api/projects/${project.id}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGroupName, default_retries: newGroupDefaultRetries })
    });
    if (res.ok) {
      const { id } = await res.json();
      const newGroup: IntegrationGroup = { 
        id, 
        project_id: project.id, 
        name: newGroupName, 
        description: '', 
        default_retries: newGroupDefaultRetries,
        created_at: new Date().toISOString() 
      };
      setGroups([...groups, newGroup]);
      setGroupId(id);
      if (!initialData) {
        setRetries(newGroupDefaultRetries);
      }
      setNewGroupName('');
      setNewGroupDefaultRetries(0);
      setShowNewGroupModal(false);
    }
  };

  const addStep = (type: string) => {
    const newStep = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      name: type.charAt(0).toUpperCase() + type.slice(1),
      config: type === 'splitter' ? { splitCount: 10, branchCount: 1 } : 
              type === 'multicast' ? { branchCount: 2 } : {}
    };
    const newSteps = [...steps];
    newSteps.splice(newSteps.length - 1, 0, newStep);
    setSteps(newSteps);
  };

  const removeStep = (id: string) => {
    if (steps.find(s => s.id === id)?.type === 'start' || steps.find(s => s.id === id)?.type === 'end') return;
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStepConfig = (id: string, config: any) => {
    setSteps(steps.map(s => s.id === id ? { ...s, config: { ...s.config, ...config } } : s));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-3xl p-4 md:p-8 border border-zinc-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="flex-1">
              <label className="text-xs font-bold text-zinc-400 uppercase mb-2 block">{t('Integration Name')}</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-2xl font-bold text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-emerald-500 focus:outline-none w-full transition-all"
                placeholder={t('Integration Name')}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => addStep('splitter')} className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('Splitter')}
              </button>
              <button onClick={() => addStep('api_call')} className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('API Call')}
              </button>
              <button onClick={() => addStep('multicast')} className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('Multicast')}
              </button>
            </div>
          </div>

          <div className="relative flex flex-col items-center gap-8 py-8">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className={cn(
                  "relative w-full max-w-md p-4 md:p-6 rounded-2xl border-2 transition-all group",
                  step.type === 'start' || step.type === 'end' ? "bg-zinc-50 border-zinc-200" : "bg-white border-emerald-100 hover:border-emerald-500 shadow-sm"
                )}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        step.type === 'splitter' ? "bg-orange-100 text-orange-600" :
                        step.type === 'api_call' ? "bg-blue-100 text-blue-600" :
                        step.type === 'multicast' ? "bg-purple-100 text-purple-600" :
                        "bg-zinc-100 text-zinc-600"
                      )}>
                        {step.type === 'splitter' ? <Layers className="w-5 h-5" /> :
                         step.type === 'api_call' ? <Activity className="w-5 h-5" /> :
                         <FileCode className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-zinc-900 truncate">{step.name}</h4>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold truncate">{step.type}</p>
                      </div>
                    </div>
                    {step.type !== 'start' && step.type !== 'end' && (
                      <button onClick={() => removeStep(step.id)} className="p-2 text-zinc-300 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {step.type === 'splitter' && (
                    <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase mb-2 block">{t('Split Count')}</label>
                        <input 
                          type="number" 
                          value={isNaN(step.config.splitCount) ? '' : step.config.splitCount} 
                          onChange={(e) => updateStepConfig(step.id, { splitCount: parseInt(e.target.value) || 0 })}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase mb-2 block">{t('Branches')}</label>
                        <input 
                          type="number" 
                          value={isNaN(step.config.branchCount) ? '' : step.config.branchCount} 
                          onChange={(e) => updateStepConfig(step.id, { branchCount: parseInt(e.target.value) || 0 })}
                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  )}

                  {step.type === 'multicast' && (
                    <div className="mt-4 pt-4 border-t border-zinc-100">
                      <label className="text-xs font-bold text-zinc-400 uppercase mb-2 block">{t('Branch Count')}</label>
                      <input 
                        type="number" 
                        value={isNaN(step.config.branchCount) ? '' : step.config.branchCount} 
                        onChange={(e) => updateStepConfig(step.id, { branchCount: parseInt(e.target.value) || 0 })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className="w-px h-8 bg-zinc-200 relative">
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 border-r-2 border-b-2 border-zinc-200 rotate-45" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm">
          <h3 className="text-xl font-bold text-zinc-900 mb-6">Simulation Parameters</h3>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-zinc-700">Payload Size (KB)</label>
                <span className="text-emerald-600 font-bold">{payloadSize} KB</span>
              </div>
              <input 
                type="range" min="1" max="2000" value={payloadSize || 0} 
                onChange={(e) => setPayloadSize(parseInt(e.target.value) || 0)}
                className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              
              {/* Visual Payload Splitting */}
              <div className="mt-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Message Units (250KB each)</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">x{Math.ceil(payloadSize / 250)} Factor</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.ceil(payloadSize / 250) }).map((_, i) => {
                    const remaining = payloadSize - (i * 250);
                    const fillPercent = Math.min(100, Math.max(0, (remaining / 250) * 100));
                    return (
                      <div key={i} className="w-8 h-8 rounded-lg bg-zinc-200 relative overflow-hidden" title={`Unit ${i+1}: ${Math.min(250, remaining)}KB`}>
                        <div 
                          className="absolute bottom-0 left-0 w-full bg-emerald-500 transition-all duration-300" 
                          style={{ height: `${fillPercent}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white mix-blend-difference">
                          {i + 1}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-zinc-400 mt-3 leading-tight">
                  SAP CPI bills per 250KB unit. Your {payloadSize}KB payload requires {Math.ceil(payloadSize / 250)} units per message.
                </p>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-zinc-700">Daily Volume</label>
                <span className="text-emerald-600 font-bold">{dailyVolume.toLocaleString()}</span>
              </div>
              <input 
                type="range" min="100" max="100000" step="100" value={dailyVolume || 0} 
                onChange={(e) => setDailyVolume(parseInt(e.target.value) || 0)}
                className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-zinc-700 mb-2 block">Retry Strategy</label>
              <select 
                value={retries} 
                onChange={(e) => setRetries(parseInt(e.target.value))}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium mb-4"
              >
                <option value={0}>No Retries</option>
                <option value={1}>1 Retry (Standard)</option>
                <option value={3}>3 Retries (Aggressive)</option>
                <option value={5}>5 Retries (Critical)</option>
              </select>

              <div className="flex justify-between mb-2">
                <label className="text-sm font-bold text-zinc-700">Assumed Failure Rate</label>
                <span className="text-orange-600 font-bold">{failureRate}%</span>
              </div>
              <input 
                type="range" min="0" max="50" step="1" value={failureRate || 0} 
                onChange={(e) => setFailureRate(parseInt(e.target.value) || 0)}
                className="w-full h-2 bg-zinc-100 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <p className="text-[10px] text-zinc-400 mt-2 uppercase tracking-widest font-bold">Higher failure rates increase retry volume</p>
            </div>

            <button 
              onClick={() => onSimulate({ id: initialData?.id, project_id: project?.id, name, base_payload_size: payloadSize, daily_volume: dailyVolume, retries, failure_rate: failureRate, steps, group_id: groupId })}
              disabled={isSimulating}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" /> {initialData ? 'Update & Simulate' : 'Run Simulation'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Group Selection */}
        <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-zinc-900">Integration Group</h3>
            <button 
              onClick={() => setShowNewGroupModal(true)}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> New Group
            </button>
          </div>
          
          <div className="space-y-4">
            {groups.length === 0 ? (
              <div className="p-6 border-2 border-dashed border-zinc-100 rounded-2xl text-center">
                <Layers className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm text-zinc-500 mb-4 font-medium">No integration groups created yet.</p>
                <button 
                  onClick={() => setShowNewGroupModal(true)}
                  className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all"
                >
                  Create Your First Group
                </button>
              </div>
            ) : (
              <>
                <select 
                  value={groupId || ''} 
                  onChange={(e) => {
                    const id = e.target.value ? parseInt(e.target.value) : null;
                    setGroupId(id);
                    if (id) {
                      const group = groups.find(g => g.id === id);
                      if (group && !initialData) {
                        setRetries(group.default_retries);
                      }
                    }
                  }}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="">General (No Group)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>

                {selectedGroup && (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Layers className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Active Group</p>
                        <p className="text-sm font-bold text-zinc-900 leading-none">{selectedGroup.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Default Retries</p>
                      <p className="text-sm font-black text-emerald-600 leading-none">{selectedGroup.default_retries}</p>
                    </div>
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-zinc-400">
              Grouping helps organize integrations by business area or system (e.g., "Bank Integrations").
            </p>
          </div>
        </div>

        {showNewGroupModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">New Integration Group</h3>
              <p className="text-zinc-500 mb-6">Create a category to group related integrations.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase mb-2 block">Group Name</label>
                  <input 
                    type="text" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium mb-4"
                    placeholder="e.g., Banking, Supply Chain..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase mb-2 block">Default Retry Count</label>
                  <select 
                    value={newGroupDefaultRetries} 
                    onChange={(e) => setNewGroupDefaultRetries(parseInt(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value={0}>No Retries</option>
                    <option value={1}>1 Retry (Standard)</option>
                    <option value={3}>3 Retries (Aggressive)</option>
                    <option value={5}>5 Retries (Critical)</option>
                  </select>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowNewGroupModal(false)}
                    className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl font-bold transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleCreateGroup}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all"
                  >
                    Create Group
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-[#151619] rounded-3xl p-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-emerald-400" />
            </div>
            <h4 className="font-bold">FinOps Tip</h4>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Large payloads ( {'>'} 250KB ) are split into multiple message units. Consider compressing or filtering data before sending to CPI.
          </p>
        </div>
      </div>
    </div>
  );
};

const calculateIntegrationMonthlyMessages = (it: Integration) => {
  const MESSAGE_SIZE_LIMIT = 250;
  const DAYS_IN_MONTH = 30;
  
  let config = it.config;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch (e) {
      config = { steps: [] };
    }
  }

  const payloadFactor = Math.ceil(it.base_payload_size / MESSAGE_SIZE_LIMIT);
  const recordsPerSplit = config?.records_per_split || 1;
  const requestReplyCount = config?.request_reply_count || 0;
  const isEdge = config?.is_edge_integration || false;
  
  let splitterFactor = 1;
  const steps = config?.steps || [];
  steps.forEach((step: any) => {
    if (step.type === 'splitter') {
      splitterFactor *= (step.config?.splitCount || recordsPerSplit);
    } else if (step.type === 'multicast') {
      splitterFactor *= (step.config?.branchCount || 2);
    }
  });

  // Base executions
  const baseExecutions = it.daily_volume * DAYS_IN_MONTH;
  
  // Factor in splitters/multicast
  let totalMessages = baseExecutions * splitterFactor;
  
  // Factor in payload size
  totalMessages *= payloadFactor;
  
  // Factor in Request-Reply steps
  totalMessages *= (1 + requestReplyCount);
  
  // Factor in retries
  const p = (it.failure_rate || 2) / 100;
  const n = it.retries || 0;
  let retryMultiplier = 1;
  if (p > 0 && n > 0) {
    retryMultiplier = (1 - Math.pow(p, n + 1)) / (1 - p);
  }
  totalMessages *= retryMultiplier;
  
  // Factor in Edge Integration Cell (0.5x)
  if (isEdge) {
    totalMessages *= 0.5;
  }
  
  return Math.round(totalMessages);
};

const calculateTieredCost = (totalMonthlyMessages: number, hasProject: boolean) => {
  if (totalMonthlyMessages === 0) return hasProject ? 4000 : 0;
  
  // Base fee: $4,000 (includes first 10,000 messages)
  const baseFee = 4000;
  if (totalMonthlyMessages <= 10000) return baseFee;

  const excessMessages = totalMonthlyMessages - 10000;
  const blocksOf10K = Math.ceil(excessMessages / 10000);
  
  // Tier 1: Next 9 blocks of 10K at $1,000 per block
  // Tier 2: Above 100,000 messages at $500 per block
  
  let cost = baseFee;
  if (blocksOf10K <= 9) {
    cost += blocksOf10K * 1000;
  } else {
    cost += 9 * 1000 + (blocksOf10K - 9) * 500;
  }
  
  return cost;
};

const IntegrationItem: React.FC<{ it: Integration, onEdit: (it: Integration) => void, onDelete: (id: number) => void }> = ({ it, onEdit, onDelete }) => {
  const monthlyMessages = calculateIntegrationMonthlyMessages(it);
  const standaloneCost = calculateTieredCost(monthlyMessages, true);

  return (
    <div className="flex items-center justify-between p-4 rounded-2xl border border-zinc-100 hover:bg-zinc-50 transition-all group">
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center shrink-0">
          <Activity className="w-5 h-5 text-zinc-500" />
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-zinc-900 truncate">{it.name}</h4>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>{it.daily_volume.toLocaleString()} msg/day</span>
            <span className="w-1 h-1 rounded-full bg-zinc-300" />
            <span>{it.base_payload_size} KB</span>
            <span className="w-1 h-1 rounded-full bg-zinc-300" />
            <span className="font-bold text-emerald-600">${standaloneCost.toLocaleString()} /mo</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => onEdit(it)}
          className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors"
          title="Edit Integration"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button 
          onClick={() => onDelete(it.id)}
          className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
          title="Delete Integration"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const Dashboard = ({ project, setActiveTab, onEditIntegration }: { project: Project | null, setActiveTab: (t: string) => void, onEditIntegration: (it: Integration) => void }) => {
  const { t } = useTranslation();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [groups, setGroups] = useState<IntegrationGroup[]>([]);
  const [simulations, setSimulations] = useState<any[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'cost' | 'messages'>('cost');
  const [distributionMode, setDistributionMode] = useState<'general' | 'group'>('group');
  
  const fetchIntegrations = useCallback(() => {
    if (project) {
      fetch(`/api/projects/${project.id}/integrations`)
        .then(res => res.json())
        .then(data => setIntegrations(data));
      
      fetch(`/api/projects/${project.id}/groups`)
        .then(res => res.json())
        .then(data => setGroups(data));

      fetch(`/api/projects/${project.id}/simulations`)
        .then(res => res.json())
        .then(data => setSimulations(data));
    }
  }, [project]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleDeleteIntegration = (id: number) => {
    // Replacing confirm with a direct action for now as per iframe restrictions, 
    // but ideally should use a custom modal.
    fetch(`/api/integrations/${id}`, { method: 'DELETE' }).then(res => {
      if (res.ok) fetchIntegrations();
    });
  };

  const handleDeleteGroup = (id: number) => {
    fetch(`/api/groups/${id}`, { method: 'DELETE' }).then(res => {
      if (res.ok) fetchIntegrations();
    });
  };

  const totalMessages = integrations.reduce((acc, curr) => acc + calculateIntegrationMonthlyMessages(curr), 0);
  const totalCost = calculateTieredCost(totalMessages, !!project);

  const budgetTrend = (project?.budget && !isNaN(totalCost)) ? Math.round(((totalCost - project.budget) / project.budget) * 100) : 0;
  const messageTrend = (project?.target_messages && !isNaN(totalMessages)) ? Math.round(((totalMessages - project.target_messages) / project.target_messages) * 100) : 0;

  const data = [
    { name: 'Jan', cost: (totalCost || 0) * 0.8, messages: (totalMessages || 0) * 0.8 },
    { name: 'Feb', cost: (totalCost || 0) * 0.85, messages: (totalMessages || 0) * 0.85 },
    { name: 'Mar', cost: (totalCost || 0) * 0.9, messages: (totalMessages || 0) * 0.9 },
    { name: 'Apr', cost: (totalCost || 0) * 0.95, messages: (totalMessages || 0) * 0.95 },
    { name: 'May', cost: (totalCost || 0), messages: (totalMessages || 0) },
    { name: 'Jun', cost: (totalCost || 0) * 1.1, messages: (totalMessages || 0) * 1.1 },
  ];

  const pieData = (() => {
    if (!integrations || integrations.length === 0) return [{ id: 'none', name: 'No Integrations', value: 100, color: '#f4f4f5' }];
    
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#6366f1', '#ec4899', '#ef4444', '#8b5cf6', '#06b6d4', '#14b8a6'];
    const results: any[] = [];
    
    if (distributionMode === 'group') {
      (groups || []).forEach((group, idx) => {
        const groupVolume = integrations
          .filter(it => it.group_id === group.id)
          .reduce((acc, curr) => acc + calculateIntegrationMonthlyMessages(curr), 0);
        
        if (groupVolume > 0) {
          const share = totalMessages > 0 ? groupVolume / totalMessages : 0;
          results.push({
            id: group.id,
            name: group.name,
            value: Math.round(share * 100) || 0,
            color: colors[idx % colors.length]
          });
        }
      });
      
      const ungroupedVolume = integrations
        .filter(it => !it.group_id)
        .reduce((acc, curr) => acc + calculateIntegrationMonthlyMessages(curr), 0);
      
      if (ungroupedVolume > 0) {
        const share = totalMessages > 0 ? ungroupedVolume / totalMessages : 0;
        results.push({
          id: 'general',
          name: t('General'),
          value: Math.round(share * 100) || 0,
          color: '#94a3b8'
        });
      }
    } else {
      // General mode: by individual integration
      integrations.forEach((it, idx) => {
        const itVolume = calculateIntegrationMonthlyMessages(it);
        if (itVolume > 0) {
          const share = totalMessages > 0 ? itVolume / totalMessages : 0;
          results.push({
            id: it.id,
            name: it.name,
            value: Math.round(share * 100) || 0,
            color: colors[idx % colors.length]
          });
        }
      });
    }
    
    return results.length > 0 ? results : [{ id: 'none', name: 'No Integrations', value: 100, color: '#f4f4f5' }];
  })();

  if (!project) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-10 bg-white rounded-3xl border border-zinc-100 shadow-sm">
        <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6">
          <Layers className="w-10 h-10 text-zinc-300" />
        </div>
        <h3 className="text-2xl font-bold text-zinc-900 mb-2">{t('No project selected')}</h3>
        <p className="text-zinc-500 max-w-md mb-8">
          {t('Please select a project to view the dashboard')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <span className="text-zinc-400 font-medium">{t('Active')}:</span>
        <span className="text-emerald-600 font-bold break-all">{project?.name || t('No project selected')}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label={t('Total Monthly Cost')} 
          value={`$${Math.round(totalCost).toLocaleString()}`} 
          subValue="USD" 
          icon={DollarSign} 
          color="bg-emerald-500" 
          trend={budgetTrend}
          trendLabel={budgetTrend > 0 ? t('Over Budget') : t('Under Budget')}
          projectValue={`${t('Budget')}: $${project.budget.toLocaleString()}`}
          tooltip={t('Calculated based on SAP base fee ($4,000) plus message volume from all active integrations.')}
          trendData={data}
          dataKey="cost"
        />
        <StatCard 
          label={t('Monthly Messages')} 
          value={`${(totalMessages / 1000).toFixed(1)}k`} 
          subValue="Units" 
          icon={MessageSquare} 
          color="bg-blue-500" 
          trend={messageTrend}
          trendLabel={messageTrend > 0 ? t('Above Target') : t('Below Target')}
          projectValue={`${t('Target Msg')}: ${(project.target_messages / 1000).toFixed(1)}k`}
          tooltip={t('Total monthly message units aggregated from all integrations in this project.')}
          trendData={data}
          dataKey="messages"
        />
        <StatCard 
          label={t('Active iFlows')} 
          value={integrations.length.toString()} 
          subValue={t('Integrations')} 
          icon={Layers} 
          color="bg-purple-500" 
          projectValue={t('Project Scope')}
          tooltip={t('Number of integration flows currently simulated and saved to this project.')}
        />
        <StatCard 
          label={t('Cost Efficiency')} 
          value="94%" 
          subValue={t('Optimized')} 
          icon={Zap} 
          color="bg-orange-500" 
          projectValue={t('FinOps Score')}
          tooltip={t('FinOps score based on architectural best practices like batching and retry logic.')}
        />
      </div>

      {integrations.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-900">Project is currently empty</h4>
              <p className="text-sm text-emerald-700">Go to the <b>Cost Simulator</b> to design and add integrations to this project.</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('simulator')}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-sm shrink-0"
          >
            Open Simulator
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-3xl p-4 md:p-8 border border-zinc-100 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">{t('Cost & Volume Trends')}</h3>
                <p className="text-sm text-zinc-500">
                  {selectedMetric === 'cost' 
                    ? t("Projection of monthly SAP Integration Suite costs based on current architecture.") 
                    : t("Projection of monthly message unit volume across all project integrations.")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('View')}:</span>
                <select 
                  value={selectedMetric}
                  onChange={(e) => setSelectedMetric(e.target.value as 'cost' | 'messages')}
                  className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-auto transition-all"
                >
                  <option value="cost">{t('Total Monthly Cost')} ($)</option>
                  <option value="messages">{t('Monthly Messages')} ({t('Volume')})</option>
                </select>
              </div>
            </div>
            <div className="h-[300px] md:h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={selectedMetric === 'cost' ? "#10b981" : "#3b82f6"} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={selectedMetric === 'cost' ? "#10b981" : "#3b82f6"} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 12}} 
                    tickFormatter={(value) => selectedMetric === 'cost' ? `$${value.toLocaleString()}` : `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: any) => [
                      selectedMetric === 'cost' ? `$${Math.round(value).toLocaleString()}` : `${Math.round(value).toLocaleString()} Units`,
                      selectedMetric === 'cost' ? 'Estimated Cost' : 'Message Volume'
                    ]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={selectedMetric} 
                    stroke={selectedMetric === 'cost' ? "#10b981" : "#3b82f6"} 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorMetric)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 md:p-8 border border-zinc-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-zinc-900">{t('Integrations')}</h3>
              <button 
                onClick={() => setActiveTab('simulator')}
                className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> {t('Add Integration')}
              </button>
            </div>
            
            <div className="space-y-8">
              {/* Grouped Integrations */}
              {groups.map(group => {
                const groupIntegrations = integrations.filter(it => it.group_id === group.id);
                if (groupIntegrations.length === 0) return null;
                
                return (
                  <div key={group.id} className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                        <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">{group.name}</h4>
                        <span className="text-xs text-zinc-400 font-medium">({groupIntegrations.length})</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
                        title="Delete Group"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {groupIntegrations.map(it => (
                        <IntegrationItem 
                          key={it.id} 
                          it={it} 
                          onEdit={onEditIntegration} 
                          onDelete={handleDeleteIntegration} 
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Ungrouped Integrations */}
              {integrations.filter(it => !it.group_id).length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="w-1.5 h-4 bg-zinc-300 rounded-full" />
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">General Integrations</h4>
                    <span className="text-xs text-zinc-400 font-medium">({integrations.filter(it => !it.group_id).length})</span>
                  </div>
                  <div className="space-y-3">
                    {integrations.filter(it => !it.group_id).map(it => (
                      <IntegrationItem 
                        key={it.id} 
                        it={it} 
                        onEdit={onEditIntegration} 
                        onDelete={handleDeleteIntegration} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {integrations.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-zinc-400 text-sm">No integrations found in this project.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 md:p-8 border border-zinc-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h3 className="text-xl font-bold text-zinc-900">{t('Cost Distribution')}</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setDistributionMode('group')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  distributionMode === 'group' ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                )}
              >
                {t('By Group')}
              </button>
              <button 
                onClick={() => setDistributionMode('general')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  distributionMode === 'general' ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                )}
              >
                {t('By iFlow')}
              </button>
            </div>
          </div>
          <div className="h-[200px] md:h-[250px] mb-8">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            {pieData.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor: item.color}} />
                  <span className="text-sm font-medium text-zinc-600 truncate">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-zinc-900 shrink-0">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-zinc-900">Recent Simulations</h3>
          <button 
            onClick={() => setActiveTab('simulator')}
            className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            Run New Simulation
          </button>
        </div>
        <div className="space-y-4">
          {simulations.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-zinc-100 rounded-2xl">
              <p className="text-zinc-400 text-sm">No recent simulations found.</p>
            </div>
          ) : (
            simulations.map((sim) => (
              <div key={sim.id} className="group p-4 rounded-2xl border border-zinc-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                      <Zap className="w-5 h-5 text-zinc-500 group-hover:text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-zinc-900 truncate">{sim.name}</h4>
                      <p className="text-xs text-zinc-500">{new Date(sim.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-zinc-900">${Math.round(sim.estimated_cost_monthly).toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{Math.round(sim.total_messages_monthly / 1000)}k Messages</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const SimulationResultsView = ({ result, recommendations, onBack, projectIntegrations = [] }: { result: SimulationResult, recommendations: Recommendation[], onBack: () => void, projectIntegrations?: Integration[] }) => {
  const { t } = useTranslation();
  const [whatIfRetries, setWhatIfRetries] = useState(result.retries);
  const [compareWithId, setCompareWithId] = useState<number | ''>('');
  const [compareResult, setCompareResult] = useState<SimulationResult | null>(null);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('SAP CPI Cost Simulation Report', 20, 20);
    doc.setFontSize(12);
    doc.text(`Integration: ${result.name}`, 20, 35);
    doc.text(`Monthly Messages: ${result.monthlyMessages.toLocaleString()}`, 20, 45);
    doc.text(`Estimated Cost: $${result.estimatedCost.toLocaleString()}`, 20, 55);
    doc.text('Calculation Breakdown:', 20, 70);
    doc.text(`- Base Executions: ${result.breakdown.baseExecutions || 'N/A'}`, 20, 80);
    doc.text(`- Splitter Factor: x${result.breakdown.splitterFactor || 1}`, 20, 90);
    doc.text(`- Payload Factor: x${result.breakdown.payloadFactor || 1}`, 20, 100);
    doc.text(`- Retry Factor: x${result.breakdown.retryFactor?.toFixed(2) || 1}`, 20, 110);
    doc.text(`- Request-Reply Factor: x${result.breakdown.requestReplyFactor || 1}`, 20, 120);
    doc.save(`${result.name}_simulation.pdf`);
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet([
      { Metric: 'Integration Name', Value: result.name },
      { Metric: 'Monthly Messages', Value: result.monthlyMessages },
      { Metric: 'Estimated Cost', Value: result.estimatedCost },
      { Metric: 'Base Executions', Value: result.breakdown.baseExecutions },
      { Metric: 'Splitter Factor', Value: result.breakdown.splitterFactor },
      { Metric: 'Payload Factor', Value: result.breakdown.payloadFactor },
      { Metric: 'Retry Factor', Value: result.breakdown.retryFactor },
      { Metric: '10K Blocks', Value: result.breakdown.blocksOf10K }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Simulation');
    XLSX.writeFile(wb, `${result.name}_simulation.xlsx`);
  };

  const handleCompare = async (id: number) => {
    const it = projectIntegrations.find(i => i.id === id);
    if (!it) return;

    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: it.name,
        base_payload_size: it.base_payload_size,
        daily_volume: it.daily_volume,
        retries: it.retries,
        failure_rate: it.failure_rate,
        config: it.config
      })
    });
    if (res.ok) {
      setCompareResult(await res.json());
    }
  };

  const calculateData = (n: number) => {
    const it: any = {
      base_payload_size: result.base_payload_size,
      daily_volume: result.daily_volume,
      retries: n,
      failure_rate: result.breakdown.failureRate || 5,
      config: { steps: result.breakdown.steps || [] } // Assuming steps are in breakdown or result
    };
    
    // If steps are not in breakdown, we might need to pass them
    // Let's check where steps are stored in SimulationResult
    const monthlyMessages = calculateIntegrationMonthlyMessages(it);
    const cost = calculateTieredCost(monthlyMessages, true);

    return {
      retries: n,
      cost: Math.round(cost),
      messages: monthlyMessages
    };
  };

  const chartData = [0, 1, 2, 3, 4, 5].map(n => calculateData(n));
  const currentWhatIf = calculateData(whatIfRetries);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-500 transition-all">
            <ArrowRight className="w-5 h-5 rotate-180" />
          </button>
          <span className="text-zinc-400 font-medium">{t('Back to Simulator')}</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportPDF}
            className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          <button 
            onClick={handleExportExcel}
            className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Simulation Parameters Summary */}
      <div className="bg-zinc-50 rounded-3xl p-6 border border-zinc-100 flex flex-wrap items-center gap-x-12 gap-y-4">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('Payload Size')}</span>
          <span className="text-sm font-bold text-zinc-900">{result.base_payload_size} KB</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('Daily Volume')}</span>
          <span className="text-sm font-bold text-zinc-900">{result.daily_volume.toLocaleString()} msg/day</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('Retry Strategy')}</span>
          <span className="text-sm font-bold text-zinc-900">{result.retries} {t('Retries')}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{t('Failure Rate')}</span>
          <span className="text-sm font-bold text-zinc-900">{result.breakdown.failureRate}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-emerald-500 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-emerald-500/20">
          <h4 className="text-emerald-100 text-sm font-bold uppercase tracking-widest mb-2">{t('Estimated Monthly Cost')}</h4>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl md:text-4xl font-black break-all">${currentWhatIf.cost.toLocaleString()}</span>
            <span className="text-emerald-100 font-bold">{t('USD')}</span>
          </div>
          <div className="mt-6 pt-6 border-t border-white/20 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">
              {whatIfRetries !== result.retries ? t('What-if: {{count}} retries', { count: whatIfRetries }) : t('Based on tiered pricing model')}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 md:p-8 border border-zinc-100 shadow-sm">
          <h4 className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-2">{t('Monthly Messages')}</h4>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl md:text-4xl font-black text-zinc-900 break-all">{currentWhatIf.messages.toLocaleString()}</span>
            <span className="text-zinc-400 font-bold">{t('Units')}</span>
          </div>
          <div className="mt-6 pt-6 border-t border-zinc-100 flex items-center gap-2 text-zinc-500">
            <MessageSquare className="w-4 h-4" />
            <span className="text-sm font-medium">~{(currentWhatIf.messages / 30).toFixed(0)} {t('messages / day')}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 md:p-8 border border-zinc-100 shadow-sm md:col-span-2 lg:col-span-1">
          <h4 className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-2">{t('Payload Impact')}</h4>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl md:text-4xl font-black text-zinc-900 break-all">x{result.breakdown.payloadFactor}</span>
            <span className="text-zinc-400 font-bold">{t('Factor')}</span>
          </div>
          <div className="mt-6 pt-6 border-t border-zinc-100 flex items-center gap-2 text-zinc-500">
            <Layers className="w-4 h-4" />
            <span className="text-sm font-medium">{t('Payload size multiplier')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-zinc-100 shadow-sm overflow-hidden">
          <h3 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-emerald-500" />
            {t('AI Optimization Recommendations')}
          </h3>
          <div className="space-y-4">
            {recommendations.map((rec, i) => (
              <div key={i} className="p-4 md:p-6 rounded-2xl bg-zinc-50 border border-zinc-100 hover:border-emerald-200 transition-all group">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                  <h4 className="font-bold text-zinc-900 group-hover:text-emerald-600 transition-colors truncate">{rec.title}</h4>
                  <span className={cn(
                    "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest self-start",
                    rec.impact === 'High' ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                  )}>
                    {rec.impact === 'High' ? t('High Impact') : t('Medium Impact')}
                  </span>
                </div>
                <p className="text-sm text-zinc-500 mb-4 leading-relaxed">{rec.description}</p>
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                  <TrendingUp className="w-4 h-4" />
                  {t('Potential Savings: {{savings}}', { savings: rec.savings })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#151619] rounded-3xl p-6 md:p-8 text-white shadow-xl">
          <h3 className="text-xl font-bold mb-8">{t('Calculation Transparency')}</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5 gap-4">
              <span className="text-zinc-400 truncate">{t('Base Executions')}</span>
              <span className="font-mono font-bold shrink-0">{result.breakdown.baseExecutions?.toLocaleString() || (result.daily_volume * 30).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5 gap-4">
              <span className="text-zinc-400 truncate">{t('Splitter/Multicast Factor')}</span>
              <span className="font-mono font-bold text-orange-400 shrink-0">×{result.breakdown.splitterFactor || result.breakdown.multiplier || 1}</span>
            </div>
            <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5 gap-4">
              <span className="text-zinc-400 truncate">{t('250 KB Rule Factor')}</span>
              <span className="font-mono font-bold text-blue-400 shrink-0">×{result.breakdown.payloadFactor || 1}</span>
            </div>
            <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5 gap-4">
              <span className="text-zinc-400 truncate">{t('Retry Overhead Factor')}</span>
              <span className="font-mono font-bold text-emerald-400 shrink-0">×{result.breakdown.retryFactor?.toFixed(2) || 1}</span>
            </div>
            <div className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5 gap-4">
              <span className="text-zinc-400 truncate">{t('Request-Reply Factor')}</span>
              <span className="font-mono font-bold text-purple-400 shrink-0">×{result.breakdown.requestReplyFactor || 1}</span>
            </div>
            {result.breakdown.edgeFactor && result.breakdown.edgeFactor < 1 && (
              <div className="flex justify-between items-center p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 gap-4">
                <span className="text-emerald-400 truncate">{t('Edge Integration Factor')}</span>
                <span className="font-mono font-bold text-emerald-400 shrink-0">×{result.breakdown.edgeFactor}</span>
              </div>
            )}
            <div className="mt-8 p-6 rounded-2xl bg-zinc-800 border border-zinc-700">
              <div className="flex justify-between items-center mb-2 gap-4">
                <span className="text-sm font-bold text-zinc-400 truncate">{t('Total Billable Messages')}</span>
                <span className="text-xl font-black text-white shrink-0">{result.breakdown.totalBillableMessages?.toLocaleString() || result.monthlyMessages.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-sm font-bold text-zinc-400 truncate">{t('10K Message Blocks')}</span>
                <span className="text-lg font-bold text-emerald-400 shrink-0">{result.breakdown.blocksOf10K || Math.ceil(Math.max(0, result.monthlyMessages - 10000) / 10000)} {t('blocks')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-zinc-900">{t('Scenario Comparison')}</h3>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('Compare with')}:</span>
            <select 
              value={compareWithId}
              onChange={(e) => {
                const id = e.target.value ? parseInt(e.target.value) : '';
                setCompareWithId(id);
                if (id) handleCompare(id);
                else setCompareResult(null);
              }}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{t('Select Integration')}</option>
              {projectIntegrations.filter(i => i.id !== result.id).map(it => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
          </div>
        </div>

        {compareResult ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100">
              <h4 className="font-bold text-zinc-900 mb-4">{result.name} (Current)</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">{t('Monthly Messages')}</span>
                  <span className="font-bold">{result.monthlyMessages.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">{t('Estimated Cost')}</span>
                  <span className="font-bold text-emerald-600">${result.estimatedCost.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100">
              <h4 className="font-bold text-emerald-900 mb-4">{compareResult.name} (Comparison)</h4>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-700">{t('Monthly Messages')}</span>
                  <span className="font-bold">{compareResult.monthlyMessages.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-700">{t('Estimated Cost')}</span>
                  <span className="font-bold text-emerald-600">${compareResult.estimatedCost.toLocaleString()}</span>
                </div>
                <div className="pt-3 border-t border-emerald-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-800">{t('Difference')}</span>
                  <span className={cn(
                    "text-sm font-black",
                    compareResult.estimatedCost > result.estimatedCost ? "text-red-600" : "text-emerald-600"
                  )}>
                    {compareResult.estimatedCost > result.estimatedCost ? '+' : ''}
                    ${(compareResult.estimatedCost - result.estimatedCost).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center border-2 border-dashed border-zinc-100 rounded-2xl">
            <p className="text-zinc-400 text-sm">{t('Select another integration to see a side-by-side comparison.')}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm">
          <h3 className="text-xl font-bold text-zinc-900 mb-6">{t('SAP CPI Pricing Tiers')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-500 uppercase bg-zinc-50">
                <tr>
                  <th className="px-6 py-4 font-bold">{t('Monthly Message Volume')}</th>
                  <th className="px-6 py-4 font-bold">{t('Cost per 10K Block')}</th>
                  <th className="px-6 py-4 font-bold">{t('Total Tier Cost')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <tr>
                  <td className="px-6 py-4 font-medium text-zinc-900">{t('First 10,000 messages')}</td>
                  <td className="px-6 py-4 text-zinc-500">{t('Included in Base Fee')}</td>
                  <td className="px-6 py-4 font-bold text-zinc-900">$4,000</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium text-zinc-900">{t('10,001 - 100,000 messages')}</td>
                  <td className="px-6 py-4 text-zinc-500">$1,000</td>
                  <td className="px-6 py-4 font-bold text-zinc-900">$9,000</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium text-zinc-900">{t('Above 100,000 messages')}</td>
                  <td className="px-6 py-4 text-zinc-500">$500</td>
                  <td className="px-6 py-4 font-bold text-zinc-900">{t('Variable')}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-6 p-4 bg-zinc-50 rounded-2xl flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-500 leading-relaxed italic">
              {t('Disclaimer: These estimates are based on standard SAP CPI billing rules (SAP Note 2942344). Actual costs may vary based on your specific SAP contract, region, and additional services used. Always consult your SAP account executive for official pricing.')}
            </p>
          </div>
        </div>

      <div className="bg-zinc-900 rounded-3xl p-8 text-white border border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t('What-if Retry Analysis')}</h3>
              <p className="text-sm text-zinc-400">{t('Adjust the retry count to see real-time impact on cost and volume.')}</p>
            </div>
          </div>
          <div className="flex-1 max-w-md">
            <div className="flex justify-between mb-2">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{t('Retry Count: {{count}}', { count: whatIfRetries })}</span>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                {whatIfRetries === result.retries ? t('Current Setting') : t('Simulation Mode')}
              </span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="5" 
              step="1" 
              value={whatIfRetries} 
              onChange={(e) => setWhatIfRetries(parseInt(e.target.value))}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between mt-2 px-1">
              {[0, 1, 2, 3, 4, 5].map(v => (
                <span key={v} className="text-[10px] font-bold text-zinc-600">{v}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="text-xl font-bold text-zinc-900">{t('Retry Strategy Impact')}</h3>
            <p className="text-sm text-zinc-500">{t('Compare how different retry counts affect your monthly budget and message volume.')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">{t('Cost (USD)')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">{t('Messages')}</span>
            </div>
          </div>
        </div>
        
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f1f1" />
              <XAxis 
                dataKey="retries" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 12, fontWeight: 600 }}
                label={{ value: t('Retry Count'), position: 'bottom', offset: 0, fill: '#a1a1aa', fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}
              />
              <YAxis 
                yId="left"
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 12 }}
                tickFormatter={(val) => `$${val.toLocaleString()}`}
              />
              <YAxis 
                yId="right"
                orientation="right"
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 12 }}
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', color: '#fff' }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                formatter={(value: any, name: string) => [
                  name === 'cost' ? `$${value.toLocaleString()}` : value.toLocaleString(),
                  name === 'cost' ? t('Estimated Cost') : t('Message Volume')
                ]}
              />
              <Line 
                yId="left"
                type="monotone" 
                dataKey="cost" 
                stroke="#10b981" 
                strokeWidth={4} 
                dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 8, strokeWidth: 0 }}
              />
              <Line 
                yId="right"
                type="monotone" 
                dataKey="messages" 
                stroke="#3b82f6" 
                strokeWidth={4} 
                dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 8, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </div>
);
};

const parseIFlow = async (file: File) => {
  const zip = new JSZip();
  let xmlContent = '';

  try {
    if (file.name.endsWith('.iflw') || file.name.endsWith('.zip')) {
      const content = await zip.loadAsync(file);
      // Look for .iflw file inside the zip
      const iflwFile = Object.keys(content.files).find(name => name.endsWith('.iflw'));
      if (iflwFile) {
        xmlContent = await content.files[iflwFile].async('string');
      }
    } else if (file.name.endsWith('.xml')) {
      xmlContent = await file.text();
    }
  } catch (e) {
    console.error("Error parsing file:", e);
    return null;
  }

  if (!xmlContent) return null;

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  // Helper to find nodes regardless of namespace
  const findNodes = (tagName: string, nameAttr?: string) => {
    const nodes = Array.from(xmlDoc.getElementsByTagNameNS("*", tagName));
    if (nameAttr) {
      return nodes.filter(n => n.getAttribute('name')?.toLowerCase().includes(nameAttr.toLowerCase()));
    }
    return nodes;
  };

  const splitters = findNodes('serviceTask', 'Splitter');
  const multicasts = findNodes('serviceTask', 'Multicast');
  const requestReplies = findNodes('serviceTask', 'Request-Reply').concat(findNodes('serviceTask', 'RequestReply'));
  const timers = Array.from(xmlDoc.getElementsByTagNameNS("*", "timerEventDefinition"));
  
  // Adapters and properties
  const properties = Array.from(xmlDoc.getElementsByTagNameNS("*", "property"));
  let hasInternal = false;
  let isStandard = false;

  properties.forEach(prop => {
    const key = prop.getAttribute('key');
    const value = prop.getAttribute('value');
    if (key === 'componentType' && (value === 'ProcessDirect' || value === 'JMS')) {
      hasInternal = true;
    }
    // Some standard content has specific markers
    if (key === 'isStandardContent' && value === 'true') {
      isStandard = true;
    }
  });

  // Check if it's standard content by looking at the name or other markers
  if (xmlContent.includes('sap.com') || xmlContent.includes('sap-standard')) {
    isStandard = true;
  }

  return {
    splitters: splitters.length,
    multicasts: multicasts.length,
    requestReplies: requestReplies.length,
    hasTimer: timers.length > 0,
    hasInternal,
    isStandard,
    nodeCount: xmlDoc.getElementsByTagNameNS("*", "*").length
  };
};

const FlowAnalyzer = ({ projects }: { projects: Project[] }) => {
  const { t } = useTranslation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('');
  const [groups, setGroups] = useState<IntegrationGroup[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Smart Form Inputs
  const [executionsPerMonth, setExecutionsPerMonth] = useState(30000);
  const [avgPayloadSize, setAvgPayloadSize] = useState(10);
  const [recordsPerSplit, setRecordsPerSplit] = useState(1);
  const [retryRate, setRetryRate] = useState(2);
  const [workerNodes, setWorkerNodes] = useState(1);
  const [isEdge, setIsEdge] = useState(false);
  const [isStandard, setIsStandard] = useState(false);

  useEffect(() => {
    if (selectedProjectId) {
      fetch(`/api/projects/${selectedProjectId}/groups`)
        .then(res => res.json())
        .then(data => setGroups(data));
    } else {
      setGroups([]);
    }
    setSelectedGroupId('');
  }, [selectedProjectId]);

  const handleAddToProject = async () => {
    if (!selectedProjectId || !analysisResult) return;
    
    setIsSaving(true);
    try {
      const integrationData = {
        name: analysisResult.name,
        type: 'Analyzed iFlow',
        base_payload_size: avgPayloadSize,
        daily_volume: Math.round(executionsPerMonth / 30),
        retries: Math.ceil(retryRate / 10), // Rough mapping for now
        failure_rate: retryRate,
        config: { 
          steps: [
            ...Array.from({ length: analysisResult.detected.splitters }).map((_, i) => ({
              id: `splitter_${i}`,
              type: 'splitter',
              name: 'Splitter',
              config: { splitCount: recordsPerSplit }
            })),
            ...Array.from({ length: analysisResult.detected.multicasts }).map((_, i) => ({
              id: `multicast_${i}`,
              type: 'multicast',
              name: 'Multicast',
              config: { branchCount: 2 }
            })),
            ...Array.from({ length: analysisResult.detected.requestReplies }).map((_, i) => ({
              id: `rr_${i}`,
              type: 'api_call',
              name: 'Request-Reply',
              config: {}
            }))
          ],
          records_per_split: recordsPerSplit,
          is_edge_integration: isEdge,
          is_sap_standard: isStandard,
          worker_nodes: workerNodes,
          request_reply_count: analysisResult.detected.requestReplies,
          has_timer: analysisResult.detected.hasTimer,
          has_internal_adapters: analysisResult.detected.hasInternal
        },
        group_id: selectedGroupId || null
      };

      const res = await fetch(`/api/projects/${selectedProjectId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(integrationData)
      });

      if (res.ok) {
        const savedIntegration = await res.json();
        
        // Trigger simulation
        await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: selectedProjectId,
            integration_id: savedIntegration.id,
            name: integrationData.name,
            base_payload_size: integrationData.base_payload_size,
            daily_volume: integrationData.daily_volume,
            retries: integrationData.retries,
            failure_rate: integrationData.failure_rate,
            steps: integrationData.config.steps,
            config: integrationData.config
          })
        });

        setShowAddModal(false);
        console.log(t('Integration added successfully'));
      } else {
        console.error(t('Failed to add integration'));
      }
    } catch (error) {
      console.error("Error adding integration:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsAnalyzing(true);
    const detected = await parseIFlow(file);
    
    setTimeout(() => {
      setIsAnalyzing(false);
      if (detected) {
        setAnalysisResult({
          name: file.name,
          nodes: detected.nodeCount,
          complexity: detected.splitters + detected.multicasts > 3 ? 'High' : 'Medium',
          detected: detected,
          score: Math.max(0, 100 - (detected.splitters * 10) - (detected.multicasts * 5))
        });
        
        // Auto-update smart form
        setIsStandard(detected.isStandard);
        if (detected.hasTimer) setWorkerNodes(2); // Suggest 2 nodes if timer detected
      }
    }, 1500);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/xml': ['.iflw', '.xml'],
      'application/json': ['.json']
    },
    multiple: false
  } as any);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div 
        {...getRootProps()} 
        className={cn(
          "bg-white rounded-3xl p-12 border-2 border-dashed flex flex-col items-center justify-center text-center group transition-all cursor-pointer",
          isDragActive ? "border-emerald-500 bg-emerald-50" : "border-zinc-200 hover:border-emerald-500"
        )}
      >
        <input {...getInputProps()} />
        <div className="w-20 h-20 bg-zinc-50 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-emerald-50 transition-all">
          <Upload className={cn("w-10 h-10 transition-colors", isDragActive ? "text-emerald-500" : "text-zinc-400 group-hover:text-emerald-500")} />
        </div>
        <h3 className="text-2xl font-bold text-zinc-900 mb-2">
          {isDragActive ? t('Drop the file here') : t('Upload iFlow Definition')}
        </h3>
        <p className="text-zinc-500 max-w-md mb-8">
          {t('Drag and drop your .iflw, XML or JSON export from SAP Integration Suite to analyze its cost structure.')}
        </p>
        <button 
          className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center gap-2"
        >
          <Search className="w-5 h-5" /> {t('Select File')}
        </button>
      </div>

      {isAnalyzing && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-medium">{t('Parsing integration nodes...')}</p>
        </div>
      )}

      {analysisResult && !isAnalyzing && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-zinc-900">{t('Analysis Result: {{name}}', { name: analysisResult.name })}</h3>
                <div className="flex gap-2">
                  {analysisResult.detected.isStandard && (
                    <div className="px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1">
                      <Zap className="w-3 h-3" /> {t('SAP Standard Content')}
                    </div>
                  )}
                  <div className="px-4 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                    {t('Complexity: {{complexity}}', { complexity: analysisResult.complexity })}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">{t('Splitters')}</span>
                  <span className="text-xl font-black text-zinc-900">{analysisResult.detected.splitters}</span>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">{t('Multicasts')}</span>
                  <span className="text-xl font-black text-zinc-900">{analysisResult.detected.multicasts}</span>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">{t('Req-Reply')}</span>
                  <span className="text-xl font-black text-zinc-900">{analysisResult.detected.requestReplies}</span>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">{t('Efficiency')}</span>
                  <span className="text-xl font-black text-emerald-600">{analysisResult.score}%</span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-zinc-900 mb-4">{t('Detected Components')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysisResult.detected.hasTimer && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-50 border border-orange-100">
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-orange-900">{t('Timer Start Detected')}</p>
                        <p className="text-[10px] text-orange-700">{t('Worker nodes input enabled')}</p>
                      </div>
                    </div>
                  )}
                  {analysisResult.detected.hasInternal && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-900">{t('Internal Adapters')}</p>
                        <p className="text-[10px] text-blue-700">{t('ProcessDirect/JMS detected (Free)')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm">
              <h3 className="text-xl font-bold text-zinc-900 mb-6">{t('Smart Simulation Form')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">{t('Executions per Month')}</label>
                    <input 
                      type="number" 
                      value={executionsPerMonth}
                      onChange={(e) => setExecutionsPerMonth(parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">{t('Avg Payload Size (KB)')}</label>
                    <input 
                      type="number" 
                      value={avgPayloadSize}
                      onChange={(e) => setAvgPayloadSize(parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  {analysisResult.detected.splitters > 0 && (
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">{t('Records per Split')}</label>
                      <input 
                        type="number" 
                        value={recordsPerSplit}
                        onChange={(e) => setRecordsPerSplit(parseInt(e.target.value) || 0)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">{t('Retry Rate (%)')}</label>
                    <input 
                      type="number" 
                      value={retryRate}
                      onChange={(e) => setRetryRate(parseInt(e.target.value) || 0)}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  {analysisResult.detected.hasTimer && (
                    <div>
                      <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">{t('Worker Nodes')}</label>
                      <input 
                        type="number" 
                        value={workerNodes}
                        onChange={(e) => setWorkerNodes(parseInt(e.target.value) || 0)}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-3 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={isEdge}
                          onChange={(e) => setIsEdge(e.target.checked)}
                          className="w-5 h-5 rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                        />
                      </div>
                      <span className="text-sm font-bold text-zinc-700 group-hover:text-emerald-600 transition-colors">{t('Edge Integration Cell (0.5x)')}</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox" 
                          checked={isStandard}
                          onChange={(e) => setIsStandard(e.target.checked)}
                          className="w-5 h-5 rounded border-zinc-300 text-emerald-500 focus:ring-emerald-500"
                        />
                      </div>
                      <span className="text-sm font-bold text-zinc-700 group-hover:text-emerald-600 transition-colors">{t('SAP Standard Content')}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-[#151619] rounded-3xl p-8 text-white shadow-xl">
              <h3 className="text-xl font-bold mb-6">{t('Simulation Summary')}</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('Estimated Monthly Cost')}</p>
                    <p className="text-2xl font-black text-emerald-400">
                      ${Math.round(calculateTieredCost(
                        (executionsPerMonth * (analysisResult.detected.splitters > 0 ? recordsPerSplit : 1) * (1 + analysisResult.detected.requestReplies) * Math.ceil(avgPayloadSize / 250) * (1 + retryRate/100) * (isEdge ? 0.5 : 1)),
                        true
                      )).toLocaleString()}
                      <span className="text-xs text-zinc-500 ml-1">/mo</span>
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> {t('Add to Project')}
                  </button>
                  <button 
                    onClick={() => {
                      // Logic to compare could go here
                      alert(t('Scenario comparison feature coming soon!'));
                    }}
                    className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-bold hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="w-5 h-5" /> {t('Compare Scenarios')}
                  </button>
                </div>

                <div className="pt-6 border-t border-zinc-800">
                  <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                    {t('Prices are estimates. Actual costs depend on your SAP contract and region. Reference: SAP Note 2942344.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-sm">
              <h4 className="font-bold text-zinc-900 mb-4">{t('Optimization Tips')}</h4>
              <div className="space-y-4">
                {analysisResult.detected.splitters > 1 && (
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {t('Multiple splitters detected. Consider using a local subprocess to avoid redundant message billing.')}
                    </p>
                  </div>
                )}
                {avgPayloadSize > 250 && (
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {t('Payload > 250KB will double the message count. Try to compress or split data before processing.')}
                    </p>
                  </div>
                )}
                {isEdge && (
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {t('Edge Integration Cell detected. You are benefiting from a 50% message discount.')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-bold text-zinc-900 mb-6">{t('Select Project and Subarea')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-zinc-700 mb-2 block">{t('Project')}</label>
                <select 
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">{t('Select a project')}</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-zinc-700 mb-2 block">{t('Subarea')}</label>
                <select 
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value ? parseInt(e.target.value) : '')}
                  disabled={!selectedProjectId}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="">{t('Select a subarea')}</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                >
                  {t('Cancel')}
                </button>
                <button 
                  onClick={handleAddToProject}
                  disabled={!selectedProjectId || isSaving}
                  className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('Add to Project')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SettingsView = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-zinc-100 shadow-sm">
        <h3 className="text-xl font-bold text-zinc-900 mb-8">{t('Pricing Model Configuration')}</h3>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-bold text-zinc-700 mb-2 block">{t('Base Monthly Fee (USD)')}</label>
              <input type="number" defaultValue={4000} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-sm font-bold text-zinc-700 mb-2 block">{t('Included Messages')}</label>
              <input type="number" defaultValue={10000} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          
          <div className="p-4 md:p-6 rounded-2xl bg-zinc-50 border border-zinc-100">
            <h4 className="font-bold text-zinc-900 mb-4">{t('Tiered Pricing')}</h4>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span className="text-sm text-zinc-500 w-full sm:w-32">10k - 100k</span>
                <div className="hidden sm:block flex-1 h-px bg-zinc-200" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">$</span>
                  <input type="number" defaultValue={0.10} step="0.01" className="w-full sm:w-20 bg-white border border-zinc-200 rounded-lg px-2 py-1 text-sm text-right" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <span className="text-sm text-zinc-500 w-full sm:w-32">100k+</span>
                <div className="hidden sm:block flex-1 h-px bg-zinc-200" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">$</span>
                  <input type="number" defaultValue={0.05} step="0.01" className="w-full sm:w-20 bg-white border border-zinc-200 rounded-lg px-2 py-1 text-sm text-right" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 border border-zinc-100 shadow-sm">
        <h3 className="text-xl font-bold text-zinc-900 mb-8">{t('System Integration')}</h3>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-6 rounded-2xl bg-zinc-50 border border-zinc-100 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-zinc-200 shrink-0">
                <Zap className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-zinc-900 truncate">{t('SAP BTP API')}</h4>
                <p className="text-xs text-zinc-500 line-clamp-2">{t('Connect to your real CPI tenant for live monitoring')}</p>
              </div>
            </div>
            <button className="w-full sm:w-auto px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all">
              {t('Connect')}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 md:p-6 rounded-2xl bg-zinc-50 border border-zinc-100 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-zinc-200 shrink-0">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-zinc-900 truncate">{t('FinOps Export')}</h4>
                <p className="text-xs text-zinc-500 line-clamp-2">{t('Auto-export cost reports to AWS Cost Explorer or Azure')}</p>
              </div>
            </div>
            <button className="w-full sm:w-auto px-6 py-2 bg-zinc-200 text-zinc-700 rounded-xl font-bold text-sm hover:bg-zinc-300 transition-all">
              {t('Configure')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-4">
        <button className="px-8 py-3 bg-zinc-100 text-zinc-700 rounded-2xl font-bold hover:bg-zinc-200 transition-all w-full sm:w-auto">{t('Discard Changes')}</button>
        <button className="px-8 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all w-full sm:w-auto">{t('Save Configuration')}</button>
      </div>
    </div>
  );
};

// --- Main App ---


export default function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<any>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectBudget, setNewProjectBudget] = useState<number>(5000);
  const [newProjectTarget, setNewProjectTarget] = useState<number>(100000);

  const fetchProjects = useCallback(async () => {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data);
    if (data.length > 0 && !selectedProject) {
      setSelectedProject(data[0]);
    }
  }, [selectedProject]);

  const fetchIntegrations = useCallback(async () => {
    if (selectedProject) {
      const res = await fetch(`/api/projects/${selectedProject.id}/integrations`);
      const data = await res.json();
      setIntegrations(data);
    } else {
      setIntegrations([]);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleCreateProject = async () => {
    if (!newProjectName) return;
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: newProjectName, 
        description: newProjectDesc,
        budget: newProjectBudget,
        target_messages: newProjectTarget
      })
    });
    if (res.ok) {
      setShowNewProjectModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectBudget(5000);
      setNewProjectTarget(100000);
      fetchProjects();
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    // Replacing confirm with a direct action for now as per iframe restrictions
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      if (selectedProject?.id === id) setSelectedProject(null);
      fetchProjects();
    }
  };

  const handleSimulate = async (data: any) => {
    setIsSimulating(true);
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      setSimulationResult(result);
      
      // Save or Update integration to project if one is selected
      if (selectedProject) {
        const integrationData = {
          name: data.name || 'Simulated Integration',
          type: 'Simulation',
          base_payload_size: data.base_payload_size,
          daily_volume: data.daily_volume,
          retries: data.retries,
          failure_rate: data.failure_rate,
          config: { steps: data.steps },
          group_id: data.group_id
        };

        if (data.id) {
          // Update existing
          await fetch(`/api/integrations/${data.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(integrationData)
          });
        } else {
          // Create new
          await fetch(`/api/projects/${selectedProject.id}/integrations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(integrationData)
          });
        }
      }

      // Get AI recommendations
      const recs = await getOptimizationRecommendations({
        name: data.name,
        base_payload_size: data.base_payload_size,
        daily_volume: data.daily_volume,
        retries: data.retries,
        failure_rate: data.failure_rate,
        config: { steps: data.steps }
      } as any);
      setRecommendations(recs);
      
      setActiveTab('results');
    } catch (error) {
      console.error("Simulation failed:", error);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] font-sans text-zinc-900 overflow-hidden">
      <ErrorBoundary name="Sidebar">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
          onSimulatorClick={() => setEditingIntegration(null)}
        />
      </ErrorBoundary>
      
      <main className="flex-1 overflow-y-auto p-4 md:p-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 bg-white border border-zinc-200 rounded-xl text-zinc-500 shadow-sm"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl md:text-4xl font-black tracking-tight text-zinc-900 break-words">
                {activeTab === 'dashboard' ? t('Overview') : 
                 activeTab === 'simulator' ? t('Cost Simulator') : 
                 activeTab === 'results' ? t('Simulation Results') :
                 activeTab === 'analyzer' ? t('Flow Analyzer') :
                 activeTab === 'settings' ? t('Settings') :
                 activeTab === 'projects' ? t('Projects') :
                 activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h1>
              <p className="text-zinc-500 font-medium mt-1 text-sm md:text-base">
                {activeTab === 'dashboard' ? t('Real-time integration cost monitoring') : 
                 t('Design and estimate your SAP CPI architecture')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto pb-2 md:pb-0">
            <div className="relative flex-1 md:flex-none min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder={t('Search...')} 
                className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 md:w-64 shadow-sm"
              />
            </div>
            <button className="p-2 bg-white border border-zinc-200 rounded-xl text-zinc-500 hover:text-zinc-900 hover:border-zinc-300 transition-all shadow-sm shrink-0">
              <Filter className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-full bg-zinc-200 border-2 border-white shadow-sm overflow-hidden shrink-0">
              <img src="https://picsum.photos/seed/user/100/100" alt="User" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <ErrorBoundary name="Dashboard">
            <Dashboard 
              project={selectedProject} 
              setActiveTab={setActiveTab} 
              onEditIntegration={(it) => {
                setEditingIntegration(it);
                setActiveTab('simulator');
              }}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'simulator' && (
          <ErrorBoundary name="IntegrationDesigner">
            <IntegrationDesigner 
              onSimulate={handleSimulate} 
              initialData={editingIntegration} 
              project={selectedProject}
              isSimulating={isSimulating}
            />
          </ErrorBoundary>
        )}
        {activeTab === 'analyzer' && (
          <ErrorBoundary name="FlowAnalyzer">
            <FlowAnalyzer projects={projects} />
          </ErrorBoundary>
        )}
        {activeTab === 'settings' && (
          <ErrorBoundary name="SettingsView">
            <SettingsView />
          </ErrorBoundary>
        )}
        {activeTab === 'results' && simulationResult && (
          <ErrorBoundary name="SimulationResultsView">
            <SimulationResultsView 
              result={simulationResult} 
              recommendations={recommendations} 
              onBack={() => setActiveTab('simulator')} 
              projectIntegrations={integrations}
            />
          </ErrorBoundary>
        )}
        
        {activeTab === 'projects' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p, i) => (
              <div 
                key={p.id} 
                onClick={() => {
                  setSelectedProject(p);
                  setActiveTab('dashboard');
                }}
                className={cn(
                  "bg-white rounded-3xl p-8 border hover:shadow-md transition-all group cursor-pointer",
                  selectedProject?.id === p.id ? "border-emerald-500 shadow-sm" : "border-zinc-100"
                )}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                    selectedProject?.id === p.id ? "bg-emerald-500 text-white" : "bg-zinc-100 group-hover:bg-emerald-500 group-hover:text-white"
                  )}>
                    <Layers className="w-6 h-6" />
                  </div>
                  <button 
                    onClick={(e) => handleDeleteProject(e, p.id)}
                    className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-xl font-bold text-zinc-900 mb-2">{p.name}</h3>
                <p className="text-sm text-zinc-500 mb-6 line-clamp-2">{p.description}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Budget</span>
                    <span className="text-sm font-bold text-zinc-900">${p.budget.toLocaleString()}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Target Msg</span>
                    <span className="text-sm font-bold text-zinc-900">{(p.target_messages / 1000).toFixed(1)}k</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-zinc-50">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(u => (
                      <div key={u} className="w-8 h-8 rounded-full border-2 border-white bg-zinc-200 overflow-hidden">
                        <img src={`https://picsum.photos/seed/u${u}/50/50`} alt="User" referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
                    {t('Active')} <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
            <button 
              onClick={() => setShowNewProjectModal(true)}
              className="border-2 border-dashed border-zinc-200 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 text-zinc-400 hover:border-emerald-500 hover:text-emerald-500 transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center group-hover:bg-emerald-50 transition-all">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-bold">{t('Create New Project')}</span>
            </button>
          </div>
        )}

        {showNewProjectModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
              <h3 className="text-2xl font-bold text-zinc-900 mb-6">{t('New Project')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-zinc-700 mb-2 block">{t('Project Name')}</label>
                  <input 
                    type="text" 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. Supply Chain Optimization"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-zinc-700 mb-2 block">{t('Description')}</label>
                  <textarea 
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                    placeholder="Briefly describe the project goals..."
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 h-24 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-zinc-700 mb-2 block">{t('Monthly Budget ($)')}</label>
                    <input 
                      type="number" 
                      value={newProjectBudget}
                      onChange={(e) => setNewProjectBudget(parseInt(e.target.value))}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-zinc-700 mb-2 block">{t('Target Msg/mo')}</label>
                    <input 
                      type="number" 
                      value={newProjectTarget}
                      onChange={(e) => setNewProjectTarget(parseInt(e.target.value))}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowNewProjectModal(false)}
                    className="flex-1 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    onClick={handleCreateProject}
                    className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all"
                  >
                    {t('Create Project')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isSimulating && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-3xl p-10 flex flex-col items-center gap-6 shadow-2xl animate-in zoom-in duration-300 w-full max-w-md">
              <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center w-full">
                <h3 className="text-xl font-bold text-zinc-900">{t('Analyzing Architecture')}</h3>
                <p className="text-zinc-500 mb-4">{t('Calculating message units and running FinOps audit...')}</p>
                <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full animate-progress w-1/2" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
