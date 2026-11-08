import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  Bot,
  Cpu,
  ShieldCheck,
  Save,
  RefreshCw,
  Zap,
  Check,
  Lock,
  Unlock,
  BarChart3,
  AlertCircle,
  ChevronDown,
  RotateCcw,
  Layers
} from "lucide-react";
import {
  GlobalGeminiSystemConfig,
  GlobalGeminiFeatureConfig
} from "../../types";
import {
  updateGlobalGeminiConfig,
  subscribeGlobalGeminiConfig,
  DEFAULT_GLOBAL_GEMINI_CONFIG
} from "../../services/globalGeminiService";
import { useAuth } from "../../services/AuthContext";

interface CustomModelSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { id: string; name: string }[];
  placeholder?: string;
  openUpward?: boolean;
  compact?: boolean;
}

function normalizeModelId(rawId?: string): string {
  if (!rawId) return "";
  return rawId.replace(/^(google|gemini)[/:\s-]+/i, (match) =>
    match.toLowerCase().startsWith("google") ? "" : match
  ).replace(/^google[/:\s-]+/i, "").trim();
}

function cleanModelDisplayName(label: string): string {
  return label
    .replace(/^google\s+/i, "")
    .replace(/^gemini\s+/i, "")
    .replace(/\s*\(default\)/i, "")
    .trim();
}

function CustomModelSelect({
  value,
  onChange,
  options,
  placeholder,
  openUpward = false,
  compact = false
}: CustomModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openTop, setOpenTop] = useState(openUpward);
  const [coords, setCoords] = useState({ left: 0, top: 0, bottom: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const shouldOpenUp = (spaceBelow < 260 && rect.top > 260) || (openUpward && rect.top > 260);
      setOpenTop(shouldOpenUp);
      setCoords({
        left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 200) - 12),
        top: rect.bottom + 6,
        bottom: window.innerHeight - rect.top + 6,
        width: Math.max(rect.width, 190)
      });
    }
  };

  useLayoutEffect(() => {
    updatePosition();
    if (isOpen) {
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [isOpen, openUpward]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const normalizedValue = normalizeModelId(value);
  const selectedOption =
    options.find((o) => o.id === normalizedValue || o.id === value) ||
    (!placeholder ? options[0] : undefined);
  const displayLabel = selectedOption
    ? cleanModelDisplayName(selectedOption.name)
    : placeholder || cleanModelDisplayName(normalizedValue);

  return (
    <div className="relative inline-block text-left w-full sm:w-auto" ref={containerRef} translate="no">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-between gap-2 w-full sm:w-auto ${
          compact
            ? "sm:min-w-[150px] px-2.5 py-1.5"
            : "sm:min-w-[165px] px-3 py-1.5 sm:py-2"
        } rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 text-xs font-semibold hover:border-indigo-500/70 dark:hover:border-indigo-400/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all cursor-pointer`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-indigo-500" : ""
          }`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            translate="no"
            style={{
              left: Math.max(8, coords.left),
              width: coords.width,
              ...(openTop ? { bottom: coords.bottom } : { top: coords.top }),
              visibility: coords.width === 0 ? "hidden" : "visible"
            }}
            className="fixed z-[9999] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5 shadow-2xl text-xs max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95"
          >
            {options.map((opt) => {
              const isSelected = opt.id === normalizedValue || opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                  }`}
                >
                  <span className="truncate">{cleanModelDisplayName(opt.name)}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

interface FeatureMeta {
  key: keyof GlobalGeminiSystemConfig["features"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const MAPPED_FEATURES: FeatureMeta[] = [
  {
    key: "ai_tutor",
    label: "AI Tutor",
    icon: Bot
  },
  {
    key: "jarvis",
    label: "Jarvis AI",
    icon: Cpu
  },
  {
    key: "mock_score_extractor",
    label: "Mock Score Extractor",
    icon: BarChart3
  },
  {
    key: "vocab_extractor",
    label: "Vocabulary Extractor",
    icon: Sparkles
  }
];

const AVAILABLE_MODELS = [
  { id: "gemini-3.5-flash-lite", name: "3.5 Flash Lite" },
  { id: "gemini-3.1-flash-lite", name: "3.1 Flash Lite" },
  { id: "gemini-3.8-flash", name: "3.8 Flash" },
  { id: "gemini-3.6-flash", name: "3.6 Flash" },
  { id: "gemini-3.1-pro-preview", name: "3.1 Pro" },
  { id: "gemini-3-flash-preview", name: "3.0 Flash" },
  { id: "gemini-2.5-flash", name: "2.5 Flash" },
  { id: "gemini-2.5-flash-lite", name: "2.5 Flash Lite" },
  { id: "gemma-4-26b-a4b-it", name: "Gemma 4 26B" },
  { id: "gemma-4-31b-it", name: "Gemma 4 31B" }
];

export function AdminGlobalGeminiTab() {
  const { user } = useAuth();
  const [config, setConfig] = useState<GlobalGeminiSystemConfig>(
    DEFAULT_GLOBAL_GEMINI_CONFIG
  );
  const [savedConfig, setSavedConfig] = useState<GlobalGeminiSystemConfig>(
    DEFAULT_GLOBAL_GEMINI_CONFIG
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeGlobalGeminiConfig((fetchedConfig) => {
      setConfig(fetchedConfig);
      setSavedConfig(fetchedConfig);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const hasChanges = useMemo(() => {
    return JSON.stringify(config.features) !== JSON.stringify(savedConfig.features);
  }, [config.features, savedConfig.features]);

  const activeCount = useMemo(() => {
    return MAPPED_FEATURES.filter((f) => config.features[f.key]?.enabled).length;
  }, [config.features]);

  const allEnabled = activeCount === MAPPED_FEATURES.length;

  const uniformModel = useMemo(() => {
    const firstModel = normalizeModelId(
      config.features[MAPPED_FEATURES[0].key]?.defaultModel
    );
    const isUniform = MAPPED_FEATURES.every(
      (f) => normalizeModelId(config.features[f.key]?.defaultModel) === firstModel
    );
    return isUniform ? firstModel : "";
  }, [config.features]);

  const handleToggleFeature = (
    key: keyof GlobalGeminiSystemConfig["features"]
  ) => {
    setConfig((prev) => {
      const cur = prev.features[key] || {
        enabled: false,
        defaultModel: "gemini-3.5-flash-lite",
        lockForNonKeyUsers: true,
        lockForKeyUsers: false
      };
      return {
        ...prev,
        features: {
          ...prev.features,
          [key]: {
            ...cur,
            enabled: !cur.enabled
          }
        }
      };
    });
  };

  const handleModelChange = (
    key: keyof GlobalGeminiSystemConfig["features"],
    model: string
  ) => {
    setConfig((prev) => {
      const cur = prev.features[key] || {
        enabled: false,
        defaultModel: "gemini-3.5-flash-lite",
        lockForNonKeyUsers: true,
        lockForKeyUsers: false
      };
      return {
        ...prev,
        features: {
          ...prev.features,
          [key]: {
            ...cur,
            defaultModel: model
          }
        }
      };
    });
  };

  const handleBulkModelChange = (model: string) => {
    setConfig((prev) => {
      const nextFeatures = { ...prev.features };
      for (const feat of MAPPED_FEATURES) {
        const cur = nextFeatures[feat.key] || {
          enabled: false,
          defaultModel: "gemini-3.5-flash-lite",
          lockForNonKeyUsers: true,
          lockForKeyUsers: false
        };
        nextFeatures[feat.key] = {
          ...cur,
          defaultModel: model
        };
      }
      return {
        ...prev,
        features: nextFeatures
      };
    });
  };

  const handleBulkToggleAll = () => {
    const targetState = !allEnabled;
    setConfig((prev) => {
      const nextFeatures = { ...prev.features };
      for (const feat of MAPPED_FEATURES) {
        const cur = nextFeatures[feat.key] || {
          enabled: false,
          defaultModel: "gemini-3.5-flash-lite",
          lockForNonKeyUsers: true,
          lockForKeyUsers: false
        };
        nextFeatures[feat.key] = {
          ...cur,
          enabled: targetState
        };
      }
      return {
        ...prev,
        features: nextFeatures
      };
    });
  };

  const handleToggleLockNonKey = (
    key: keyof GlobalGeminiSystemConfig["features"]
  ) => {
    setConfig((prev) => {
      const cur = prev.features[key] || {
        enabled: false,
        defaultModel: "gemini-3.5-flash-lite",
        lockForNonKeyUsers: true,
        lockForKeyUsers: false
      };
      const currentVal = cur.lockForNonKeyUsers !== false;
      return {
        ...prev,
        features: {
          ...prev.features,
          [key]: {
            ...cur,
            lockForNonKeyUsers: !currentVal
          }
        }
      };
    });
  };

  const handleToggleLockKeyUsers = (
    key: keyof GlobalGeminiSystemConfig["features"]
  ) => {
    setConfig((prev) => {
      const cur = prev.features[key] || {
        enabled: false,
        defaultModel: "gemini-3.5-flash-lite",
        lockForNonKeyUsers: true,
        lockForKeyUsers: false
      };
      const currentVal = Boolean(cur.lockForKeyUsers);
      return {
        ...prev,
        features: {
          ...prev.features,
          [key]: {
            ...cur,
            lockForKeyUsers: !currentVal
          }
        }
      };
    });
  };

  const handleReset = () => {
    setConfig(savedConfig);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateGlobalGeminiConfig(config, user?.uid || "owner");
      setSavedConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update global gemini config:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2.5 text-indigo-500" />
        <span className="text-sm font-medium">Loading configuration...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-slate-50/50 dark:bg-slate-900/50">
      {/* Top Sticky Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 px-3.5 sm:px-6 py-3 bg-white dark:bg-slate-900 z-30 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-base leading-tight truncate">
              Global Gemini Access
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {activeCount}/{MAPPED_FEATURES.length} active
              </span>
              {hasChanges && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    Unsaved
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasChanges && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Discard unsaved changes"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Discard</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 font-semibold text-xs sm:text-sm text-white rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-300" />
            ) : (
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
            <span>
              {saving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 custom-scrollbar">
        <div className="max-w-5xl w-full mx-auto space-y-3 sm:space-y-4">
          {/* Compact Global Toolbar & Bulk Controls */}
          <div className="p-3 sm:px-5 sm:py-3 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3.5">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 shrink-0">
                <ShieldCheck className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              </div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                Server API key & default model locks
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="hidden md:flex text-[11px] font-semibold text-slate-500 dark:text-slate-400 items-center gap-1 shrink-0">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  All models:
                </span>
                <CustomModelSelect
                  value={uniformModel}
                  onChange={handleBulkModelChange}
                  options={AVAILABLE_MODELS}
                  placeholder="Mixed Models"
                  compact
                />
              </div>

              <button
                type="button"
                onClick={handleBulkToggleAll}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <Zap className={`w-3.5 h-3.5 shrink-0 ${allEnabled ? "text-amber-500" : "text-slate-400"}`} />
                <span className="truncate">{allEnabled ? "Disable All" : "Enable All"}</span>
              </button>
            </div>
          </div>

          {/* Feature Matrix Card (overflow-visible so dropdowns never clip) */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
            {/* Desktop Column Headers */}
            <div className="hidden lg:grid lg:grid-cols-12 items-center gap-4 px-5 py-3 border-b border-slate-100 dark:border-slate-700/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <div className="col-span-5">Feature</div>
              <div className="col-span-3">Default Model</div>
              <div className="col-span-3">Model Enforcement Locks</div>
              <div className="col-span-1 text-right">Access</div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700/70">
              {MAPPED_FEATURES.map((feat, idx) => {
                const featConfig: GlobalGeminiFeatureConfig = config.features[
                  feat.key
                ] || {
                  enabled: false,
                  defaultModel: "gemini-3.5-flash-lite",
                  lockForNonKeyUsers: true,
                  lockForKeyUsers: false,
                  allowCustomKeyOverride: true
                };
                const IconComp = feat.icon;
                const isLockedNonKey = featConfig.lockForNonKeyUsers !== false;
                const isLockedKey = Boolean(featConfig.lockForKeyUsers);
                const openDropdownUpward = idx >= MAPPED_FEATURES.length - 2;

                return (
                  <div
                    key={feat.key}
                    className={`p-3 sm:px-5 sm:py-3.5 grid grid-cols-[1fr_auto] lg:grid-cols-12 items-center gap-2.5 sm:gap-3 lg:gap-4 transition-colors ${
                      featConfig.enabled
                        ? "hover:bg-slate-50/50 dark:hover:bg-slate-700/20"
                        : "opacity-75 hover:opacity-100"
                    }`}
                  >
                    {/* Feature Name & Icon (Row 1 Left on Mobile, Col 1-5 on Desktop) */}
                    <div className="order-1 lg:order-1 lg:col-span-5 flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div
                        className={`p-2 sm:p-2.5 rounded-xl border shrink-0 transition-colors ${
                          featConfig.enabled
                            ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                            : "bg-slate-100 dark:bg-slate-800 border-slate-200/70 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {feat.label}
                      </span>
                    </div>

                    {/* Global Access Toggle (Row 1 Right on Mobile, Col 12 on Desktop) */}
                    <div className="order-2 lg:order-4 lg:col-span-1 flex items-center justify-end">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={featConfig.enabled}
                        onClick={() => handleToggleFeature(feat.key)}
                        className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          featConfig.enabled
                            ? "bg-indigo-600"
                            : "bg-slate-200 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            featConfig.enabled
                              ? "translate-x-4 sm:translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Model Selector & Lock Buttons (Row 2 on Mobile, Col 6-11 on Desktop) */}
                    <div className="order-3 lg:order-2 col-span-2 lg:col-span-6 flex items-center justify-between sm:justify-start lg:grid lg:grid-cols-6 gap-2 lg:gap-4">
                      <div className="flex-1 sm:flex-initial lg:col-span-3 min-w-0">
                        <CustomModelSelect
                          value={featConfig.defaultModel}
                          onChange={(val) => handleModelChange(feat.key, val)}
                          options={AVAILABLE_MODELS}
                          openUpward={openDropdownUpward}
                        />
                      </div>

                      <div className="lg:col-span-3 flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleLockNonKey(feat.key)}
                          title={
                            isLockedNonKey
                              ? "Non-key users are locked to Default Model"
                              : "Non-key users can switch models"
                          }
                          className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border transition-all cursor-pointer select-none ${
                            isLockedNonKey
                              ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80"
                              : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200/80 dark:border-slate-700/70 hover:text-slate-700 dark:hover:text-slate-200"
                          }`}
                        >
                          {isLockedNonKey ? (
                            <Lock className="w-3 h-3 shrink-0" />
                          ) : (
                            <Unlock className="w-3 h-3 shrink-0 opacity-60" />
                          )}
                          <span>Non-Key</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleLockKeyUsers(feat.key)}
                          title={
                            isLockedKey
                              ? "Personal key users are locked to Default Model"
                              : "Personal key users can choose their own model"
                          }
                          className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold border transition-all cursor-pointer select-none ${
                            isLockedKey
                              ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80"
                              : "bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200/80 dark:border-slate-700/70 hover:text-slate-700 dark:hover:text-slate-200"
                          }`}
                        >
                          {isLockedKey ? (
                            <Lock className="w-3 h-3 shrink-0" />
                          ) : (
                            <Unlock className="w-3 h-3 shrink-0 opacity-60" />
                          )}
                          <span>Key Users</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Cost & Quota Guardrail Note */}
          <div className="px-3.5 py-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-900/40 flex items-center gap-2.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">
            <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="leading-snug">
              <strong className="text-amber-900 dark:text-amber-200 font-semibold">
                Tip:
              </strong>{" "}
              Locking <strong className="text-slate-800 dark:text-slate-200">Non-Key</strong> users to{" "}
              <strong className="text-slate-800 dark:text-slate-200">3.5 Flash Lite</strong> or{" "}
              <strong className="text-slate-800 dark:text-slate-200">2.5 Flash</strong> keeps server token usage minimal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

