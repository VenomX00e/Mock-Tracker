import React, { useState, useContext, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSpeedMathStore, MathPreset } from "../../store/speedMathStore";
import { Operation } from "../../utils/mathEngine";
import { AppStateCtx } from "../../context/AppContext";
import {
  Plus,
  Minus,
  X,
  Divide,
  Square,
  Cuboid,
  Search,
  Play,
  Settings,
  Plus as PlusIcon,
  Trash2,
  ChevronDown,
  Layers,
  Zap as ZapIcon,
} from "lucide-react";
import { MathArena, MathArenaConfig } from "./MathArena";
import { OperationConfigurator } from "./OperationConfigurator";
import { SpeedMathPresetModal } from "./SpeedMathPresetModal";
import { SpeedMathPresetCard } from "./SpeedMathPresetCard";
import { SpeedMathOperationTile } from "./SpeedMathOperationTile";
import { useSystemDocsQuery } from "../../hooks/useSystemDocsQuery";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { jarvisEventBus, JarvisActionEvent } from '../../features/jarvis/utils/eventBus';
import { useSeriesVault } from "../../hooks/useSeriesVault";
import { SeriesVaultDashboard } from "./speedmath/SeriesVaultDashboard";
import { SeriesPracticeArena } from "./speedmath/SeriesPracticeArena";
import { SeriesPattern, SeriesPracticeLevel } from "../../types/seriesTypes";

export const basicOperations: {
  name: string;
  op: Operation;
  icon: React.ReactNode;
  desc: string;
  defaultRange: [number, number];
}[] = [
  {
    name: "Addition",
    op: "+",
    icon: <Plus className="w-5 h-5" />,
    desc: "Practice fast addition",
    defaultRange: [10, 100],
  },
  {
    name: "Subtraction",
    op: "-",
    icon: <Minus className="w-5 h-5" />,
    desc: "Quick mental subtraction",
    defaultRange: [10, 100],
  },
  {
    name: "Multiplication",
    op: "*",
    icon: <X className="w-5 h-5" />,
    desc: "Multiply double digits",
    defaultRange: [10, 30],
  },
  {
    name: "Division",
    op: "/",
    icon: <Divide className="w-5 h-5" />,
    desc: "Perfect divisions",
    defaultRange: [10, 100],
  },
  {
    name: "Squares",
    op: "sq",
    icon: <Square className="w-5 h-5" />,
    desc: "Squares up to 30",
    defaultRange: [2, 30],
  },
  {
    name: "Cubes",
    op: "cube",
    icon: <Cuboid className="w-5 h-5" />,
    desc: "Cubes up to 20",
    defaultRange: [2, 20],
  },
  {
    name: "Fractions",
    op: "frac",
    icon: <Search className="w-5 h-5" />,
    desc: "Fractions to percentage",
    defaultRange: [1, 10],
  },
  {
    name: "Multiplication Table",
    op: "table",
    icon: <X className="w-5 h-5 text-indigo-500" />,
    desc: "Practice specific times tables",
    defaultRange: [12, 20],
  },
  {
    name: "Mixture Challenge",
    op: "mix",
    icon: <Search className="w-5 h-5 text-amber-500" />,
    desc: "Mixed operations equations",
    defaultRange: [5, 50],
  },
  {
    name: "Number Series",
    op: "series",
    icon: <Layers className="w-5 h-5 text-indigo-500" />,
    desc: "Saved & exam series patterns",
    defaultRange: [1, 10],
  },
];

export function SpeedMathHub() {
  const [currentView, setCurrentView] = useState<"training" | "vault">("training");
  const [activeSeriesDrill, setActiveSeriesDrill] = useState<{
    pattern: SeriesPattern | 'ALL';
    level: SeriesPracticeLevel;
  } | null>(null);
  const { patterns } = useSeriesVault();
  const { isOwner, adminPermissions } = useContext(AppStateCtx)!;
  const canManageLearning = isOwner || adminPermissions?.canManageLearning;

  const { speedMathConfig, mutateSystemDocs } = useSystemDocsQuery();
  const deletedDefaultPresets: string[] = speedMathConfig?.deletedDefaultPresets || [];

  const {
    presets,
    addPreset,
    removePreset,
    updatePreset,
    tileSettings,
    updateTileSettings,
  } = useSpeedMathStore();

  const handleRemovePreset = async (id: string, isDefault?: boolean) => {
    removePreset(id);
    if (isDefault && canManageLearning) {
      try {
        const docRef = doc(db, "system", "speedMathConfig");
        await setDoc(docRef, {
          deletedDefaultPresets: [...deletedDefaultPresets, id]
        }, { merge: true });
        mutateSystemDocs();
      } catch(err) {
        console.error("Failed to sync deleted preset", err);
      }
    }
  };

  const filteredPresets = presets.filter(p => !p.isDefault || !deletedDefaultPresets.includes(p.id));

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [activeConfig, setActiveConfig] = useState<MathArenaConfig | null>(
    null,
  );
  const [activeSettingsTile, setActiveSettingsTile] =
    useState<Operation | null>(null);

  // Modal State
  const [newPresetName, setNewPresetName] = useState("");
  const [selectedOps, setSelectedOps] = useState<Operation[]>(["+", "-"]);
  const [timeLimit, setTimeLimit] = useState<number | string>(60);
  const [questionCount, setQuestionCount] = useState<number | string>(20);
  const [presetMode, setPresetMode] = useState<"TIME" | "QUESTIONS">("TIME");
  const [presetConfigMode, setPresetConfigMode] = useState<
    "GLOBAL" | "INDIVIDUAL"
  >("GLOBAL");
  const [presetShuffle, setPresetShuffle] = useState<boolean>(false);
  const [presetOverrides, setPresetOverrides] = useState<any>({});
  const [expandedOp, setExpandedOp] = useState<Operation | null>(null);

  const getTileSetting = (op: Operation) => {
    const defaultR = basicOperations.find((b) => b.op === op)?.defaultRange || [
      1, 10,
    ];
    const defaultSettings = {
      mode: "TIME" as const,
      duration: 60,
      timeUnit: "SEC" as const,
      difficulty: "EASY" as const,
      customRanges: `${defaultR[0]}-${defaultR[1]}`,
      seriesMode: "MISSING" as const,
      seriesSource: "VAULT" as const,
      seriesCategory: "all",
    };
    return { ...defaultSettings, ...(tileSettings[op] || {}) };
  };

  const handleStartBasic = (op: Operation) => {
    const settings = getTileSetting(op);
    setActiveConfig({
      operations: [op],
      baseSettings: {
        mode: settings.mode,
        duration: settings.duration,
        timeUnit: settings.timeUnit,
        questionCount: settings.questionCount,
      },
      overrides: {
        [op]: {
          difficulty: settings.difficulty,
          customRanges: settings.customRanges,
          isReverse: settings.isReverse,
          seriesMode: settings.seriesMode,
          seriesSource: settings.seriesSource,
          seriesCategory: settings.seriesCategory,
        },
      },
      name: basicOperations.find((b) => b.op === op)?.name || "Practice Mode",
    });
  };

  useEffect(() => {
    const handleJarvisAction = (action: JarvisActionEvent) => {
      if (action.type === 'EXECUTE_INTENT') {
        const payload = action.payload || {};

        if (action.intent === 'START_SPEED_MATH_DRILL' || action.intent === 'START_MATH_DRILL') {
          const opInput = (action.operation || payload.operation || '').toLowerCase();
          const found = basicOperations.find(b => 
            b.op.toLowerCase() === opInput ||
            b.name.toLowerCase().includes(opInput) ||
            opInput.includes(b.name.toLowerCase()) ||
            (opInput === '+' && b.op === '+') ||
            (opInput === '-' && b.op === '-') ||
            (opInput === '*' && b.op === '*') ||
            (opInput === '/' && b.op === '/')
          ) || basicOperations[0];

          if (found) {
            const rawAction = action as any;
            const tileSet = getTileSetting(found.op);
            const duration = payload.duration ?? rawAction.settings?.duration ?? tileSet.duration;
            const timeUnit = payload.timeUnit || rawAction.settings?.timeUnit || tileSet.timeUnit || 'SEC';
            const difficulty = (payload.difficulty || rawAction.settings?.difficulty || tileSet.difficulty || 'MEDIUM').toUpperCase();
            const mode = (payload.mode || rawAction.settings?.mode || tileSet.mode || 'TIME').toUpperCase();
            const questionCount = payload.questionCount ?? rawAction.settings?.questionCount ?? tileSet.questionCount ?? 20;

            setActiveConfig({
              operations: [found.op],
              baseSettings: {
                mode: mode as any,
                duration: Number(duration) || 60,
                timeUnit: timeUnit as any,
                questionCount: Number(questionCount) || 20,
              },
              overrides: {
                [found.op]: {
                  difficulty: difficulty as any,
                  customRanges: tileSet.customRanges,
                  isReverse: tileSet.isReverse,
                },
              },
              name: found.name,
            });
          }
        } else if (action.intent === 'START_SPEED_MATH_PRESET') {
          const rawAction = action as any;
          const presetName = (payload.presetName || rawAction.presetName || '').toLowerCase();
          const matchedPreset = filteredPresets.find(p => 
            p.name.toLowerCase().includes(presetName) || presetName.includes(p.name.toLowerCase())
          );
          if (matchedPreset) {
            handleStartPreset(matchedPreset);
          }
        }
      }
    };
    const unsubscribe = jarvisEventBus.subscribe(handleJarvisAction);
    return () => unsubscribe();
  }, [tileSettings, filteredPresets]);

  const handleStartPreset = (preset: MathPreset) => {
    setActiveConfig({
      operations: preset.operations,
      baseSettings: preset.baseSettings || {
        mode: "TIME",
        duration: (preset as any).timeLimit || 60,
        timeUnit: "SEC",
        questionCount: 20,
      },
      overrides: preset.overrides || {},
      digitRange: (preset as any).digitRange, // legacy
      timeLimit: (preset as any).timeLimit, // legacy
      name: preset.name,
    });
  };

  const toggleOp = (op: Operation) => {
    if (selectedOps.includes(op)) {
      if (selectedOps.length > 1) {
        // Prevent empty operations
        setSelectedOps(selectedOps.filter((o) => o !== op));
      }
    } else {
      setSelectedOps([...selectedOps, op]);
    }
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;

    const presetData = {
      name: newPresetName,
      operations: selectedOps,
      baseSettings: {
        mode: presetMode,
        duration: Number(timeLimit) || 60,
        timeUnit: "SEC" as const,
        questionCount: Number(questionCount) || 20,
        configMode: presetConfigMode,
        shuffle: presetShuffle,
      },
      overrides: presetOverrides,
    };

    if (editingPresetId) {
      updatePreset(editingPresetId, presetData);
    } else {
      addPreset({
        id: Math.random().toString(36).substring(2, 9),
        ...presetData,
        isDefault: false,
      });
    }

    setIsModalOpen(false);
    setEditingPresetId(null);
    // Reset form
    setNewPresetName("");
    setSelectedOps(["+", "-"]);
    setTimeLimit(60);
    setQuestionCount(20);
    setPresetMode("TIME");
    setPresetConfigMode("GLOBAL");
    setPresetShuffle(false);
    setPresetOverrides({});
  };

  const handleOpenEditPreset = (preset: MathPreset) => {
    setEditingPresetId(preset.id);
    setNewPresetName(preset.name);
    setSelectedOps(preset.operations);
    setPresetMode(preset.baseSettings?.mode || "TIME");
    setTimeLimit(preset.baseSettings?.duration || 60);
    setQuestionCount(preset.baseSettings?.questionCount || 20);
    setPresetConfigMode(preset.baseSettings?.configMode || "GLOBAL");
    setPresetShuffle(preset.baseSettings?.shuffle || false);
    setPresetOverrides(preset.overrides || {});
    setIsModalOpen(true);
  };

  if (activeConfig) {
    return (
      <div className="w-full h-full">
        <MathArena
          config={activeConfig}
          onClose={() => setActiveConfig(null)}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-6 pb-10">
      {/* Sub-Header Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setCurrentView("training")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
            currentView === "training"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700"
          }`}
        >
          <ZapIcon className="w-4 h-4" />
          <span>Training</span>
        </button>

        <button
          onClick={() => setCurrentView("vault")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
            currentView === "vault"
              ? "bg-indigo-600 text-white shadow-xs"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Pattern Vault</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            currentView === "vault"
              ? "bg-white/20 text-white"
              : "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
          }`}>
            {patterns.length}
          </span>
        </button>
      </div>

      {currentView === "vault" ? (
        <SeriesVaultDashboard 
          onStartPractice={(pat, lvl) => {
            setActiveSeriesDrill({ pattern: pat, level: lvl });
          }}
        />
      ) : (
        <>
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-white mb-1 md:mb-2 text-balance">
              Speed Math Training
            </h2>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400">
              Improve your calculation speed for banking exams.
            </p>
          </div>

      {/* Basic Operations Grid */}
      <section>
        <h3 className="text-base md:text-lg font-medium text-slate-700 dark:text-slate-200 mb-3 md:mb-4 block">
          Single Operations
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {basicOperations.map((item) => (
            <SpeedMathOperationTile
              key={item.name}
              item={item}
              activeSettingsTile={activeSettingsTile}
              setActiveSettingsTile={setActiveSettingsTile}
              getTileSetting={getTileSetting}
              updateTileSettings={updateTileSettings}
              handleStartBasic={handleStartBasic}
            />
          ))}
        </div>
      </section>

      <div className="w-full h-px bg-slate-200 dark:bg-slate-800"></div>

      {/* Presets Section */}
      <section>
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h3 className="text-base md:text-lg font-medium text-slate-700 dark:text-slate-200">
            Mixed Practice & Presets
          </h3>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Preset
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPresets.map((preset) => (
            <SpeedMathPresetCard
              key={preset.id}
              preset={preset}
              handleStartPreset={handleStartPreset}
              handleOpenEditPreset={handleOpenEditPreset}
              removePreset={(id) => handleRemovePreset(id, preset.isDefault)}
              updatePreset={updatePreset}
              canManageLearning={canManageLearning}
            />
          ))}
        </div>
      </section>
      </>
    )}

      {/* Create / Edit Preset Modal */}
      <SpeedMathPresetModal
        isModalOpen={isModalOpen}
        editingPresetId={editingPresetId}
        newPresetName={newPresetName}
        setNewPresetName={setNewPresetName}
        selectedOps={selectedOps}
        setTimeLimit={setTimeLimit}
        timeLimit={timeLimit}
        questionCount={questionCount}
        setQuestionCount={setQuestionCount}
        presetMode={presetMode}
        setPresetMode={setPresetMode}
        presetConfigMode={presetConfigMode}
        setPresetConfigMode={setPresetConfigMode}
        presetShuffle={presetShuffle}
        setPresetShuffle={setPresetShuffle}
        presetOverrides={presetOverrides}
        setPresetOverrides={setPresetOverrides}
        expandedOp={expandedOp}
        setExpandedOp={setExpandedOp}
        handleSavePreset={handleSavePreset}
        toggleOp={toggleOp}
        handleClose={() => {
          setIsModalOpen(false);
          setEditingPresetId(null);
          setNewPresetName("");
          setSelectedOps(["+", "-"]);
          setTimeLimit(60);
          setQuestionCount(20);
          setPresetMode("TIME");
          setPresetConfigMode("GLOBAL");
          setPresetShuffle(false);
          setPresetOverrides({});
        }}
      />

      {/* Series Practice Arena Drill Modal */}
      {activeSeriesDrill && (
        <SeriesPracticeArena
          pattern={activeSeriesDrill.pattern}
          availablePatterns={patterns}
          level={activeSeriesDrill.level}
          onClose={() => setActiveSeriesDrill(null)}
          onSwitchLevel={(newLevel) => {
            setActiveSeriesDrill(prev => prev ? { ...prev, level: newLevel } : null);
          }}
        />
      )}
    </div>
  );
}
