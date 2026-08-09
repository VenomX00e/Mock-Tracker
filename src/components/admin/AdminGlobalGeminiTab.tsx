import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Bot,
  Cpu,
  FileCheck,
  BookOpen,
  MessageSquare,
  ShieldCheck,
  Save,
  RefreshCw,
  Zap,
  Check,
  Lock,
  BarChart3,
  AlertCircle,
  ChevronDown
} from "lucide-react";
import {
  GlobalGeminiSystemConfig,
  GlobalGeminiFeatureConfig
} from "../../types";
import {
  getGlobalGeminiConfig,
  updateGlobalGeminiConfig,
  subscribeGlobalGeminiConfig,
  DEFAULT_GLOBAL_GEMINI_CONFIG
} from "../../services/globalGeminiService";
import { useAuth } from "../../services/AuthContext";

interface CustomModelSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { id: string; name: string }[];
}

function CustomModelSelect({ value, onChange, options }: CustomModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.id === value) || options[0];

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between gap-2 min-w-[210px] px-3.5 py-2 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 text-xs font-semibold hover:border-indigo-500/70 dark:hover:border-indigo-400/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 shadow-2xs transition-all cursor-pointer"
      >
        <span className="truncate">{selectedOption?.name || value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180 text-indigo-500" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 sm:right-auto sm:left-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-1.5 shadow-2xl z-50 overflow-hidden text-xs max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95">
          {options.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                }`}
              >
                <span className="truncate">{opt.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FeatureMeta {
  key: keyof GlobalGeminiSystemConfig["features"];
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeText: string;
}

const MAPPED_FEATURES: FeatureMeta[] = [
  {
    key: "ypt_screenshot_parser",
    label: "YPT Screenshot Parser",
    description: "OCR & parsing of YPT daily study log screenshots in challenges.",
    icon: FileCheck,
    badgeText: "YPT Challenge"
  },
  {
    key: "ai_tutor",
    label: "AI Tutor",
    description: "Interactive AI study assistant, step-by-step topic explanations.",
    icon: Bot,
    badgeText: "Learning Hub"
  },
  {
    key: "jarvis",
    label: "Jarvis AI",
    description: "Jarvis copilot for exam prep, task routing & strategy guidance.",
    icon: Cpu,
    badgeText: "Jarvis Platform"
  },
  {
    key: "mock_exam_generator",
    label: "Mock Exam Generator",
    description: "Automated question generation and explanation extraction.",
    icon: Sparkles,
    badgeText: "Mock Exams"
  },
  {
    key: "flashcards",
    label: "Flashcard AI Generator",
    description: "Smart flashcard creation from study notes and topics.",
    icon: BookOpen,
    badgeText: "Vocabulary & Revision"
  },
  {
    key: "general_chat",
    label: "General Chat Assistant",
    description: "General question answering & chat interactions across the app.",
    icon: MessageSquare,
    badgeText: "General AI"
  }
];

const AVAILABLE_MODELS = [
  { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash Lite" },
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite (Default)" },
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash" },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro" },
  { id: "gemini-3-flash-preview", name: "Gemini 3.0 Flash" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
  { id: "gemma-4-26b-a4b-it", name: "Gemma 4 26B A4B IT" },
  { id: "gemma-4-31b-it", name: "Gemma 4 31B IT" }
];

export function AdminGlobalGeminiTab() {
  const { user } = useAuth();
  const [config, setConfig] = useState<GlobalGeminiSystemConfig>(
    DEFAULT_GLOBAL_GEMINI_CONFIG
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeGlobalGeminiConfig((fetchedConfig) => {
      setConfig(fetchedConfig);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleFeature = (
    key: keyof GlobalGeminiSystemConfig["features"]
  ) => {
    setConfig((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: {
          ...prev.features[key],
          enabled: !prev.features[key].enabled
        }
      }
    }));
  };

  const handleModelChange = (
    key: keyof GlobalGeminiSystemConfig["features"],
    model: string
  ) => {
    setConfig((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: {
          ...prev.features[key],
          defaultModel: model
        }
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateGlobalGeminiConfig(config, user?.uid || "owner");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update global gemini config:", err);
    } finally {
      setSaving(false);
    }
  };

  const activeCount = Object.values(config.features).filter((f) => f.enabled).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-indigo-500" />
        <span>Loading Global Gemini Configuration...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-50/50 dark:bg-slate-900/50">
      {/* Top Sticky Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
              Global Gemini AI Access Controls
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Manage global API key usage & enforce default models per feature
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-semibold text-xs sm:text-sm text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <Check className="w-4 h-4 text-emerald-300" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saving ? "Saving..." : saveSuccess ? "Saved!" : "Save Settings"}</span>
        </button>
      </div>

      {/* Main Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar max-w-5xl w-full mx-auto">
        {/* Banner Card */}
        <div className="relative overflow-hidden p-5 md:p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-2xl text-white shadow-md border border-indigo-500/30">
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Owner Key Management
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight text-white">
              Global Server Gemini AI Access & Model Controls
            </h2>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Control which app features are permitted to use your global server Gemini API key for users who have not provided a personal API key. Personal API keys saved by individual users will always take precedence.
            </p>
          </div>
        </div>

        {/* Analytics & Quota Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Global Access Status</p>
              <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {activeCount} of {MAPPED_FEATURES.length} Features Active
              </p>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Model Locking</p>
              <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Enforced for Global Users</p>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center gap-3.5">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-900/40">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Custom Key Overrides</p>
              <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Priority User Key</p>
            </div>
          </div>
        </div>

        {/* Feature Access Matrix */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs overflow-hidden">
          <div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-700/80">
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Feature Access & Model Enforcement Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Toggle global key access and assign forced default models for non-key users.
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
            {MAPPED_FEATURES.map((feat) => {
              const featConfig: GlobalGeminiFeatureConfig = config.features[
                feat.key
              ] || {
                enabled: false,
                defaultModel: "gemini-2.5-flash",
                allowCustomKeyOverride: true
              };
              const IconComp = feat.icon;

              return (
                <div
                  key={feat.key}
                  className="p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors"
                >
                  {/* Feature info */}
                  <div className="flex items-start gap-3.5 max-w-md">
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {feat.label}
                        </h4>
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 rounded-md border border-slate-200/60 dark:border-slate-600/60">
                          {feat.badgeText}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {feat.description}
                      </p>
                    </div>
                  </div>

                  {/* Controls: Model Selector + Access Toggle */}
                  <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                    {/* Model Selector Dropdown */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Locked Default Model
                      </label>
                      <CustomModelSelect
                        value={featConfig.defaultModel}
                        onChange={(val) => handleModelChange(feat.key, val)}
                        options={AVAILABLE_MODELS}
                      />
                    </div>

                    {/* Access Toggle */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        Global Access
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleFeature(feat.key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          featConfig.enabled
                            ? "bg-indigo-600"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            featConfig.enabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cost Guardrail Note */}
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Cost & Quota Guardrail Advice:</p>
            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
              When global key access is disabled for a feature, users will be prompted to enter their personal Gemini API key in Settings. Enforcing <strong>Gemini 2.5 Flash</strong> for non-key users offers the optimal response speed and minimal token consumption balance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
