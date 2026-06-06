import React from "react";
import { Settings, X, Play, ArrowLeftRight } from "lucide-react";
import { Operation } from "../../utils/mathEngine";
import { OperationConfigurator } from "./OperationConfigurator";

export interface BasicOperation {
  name: string;
  op: Operation;
  icon: React.ReactNode;
  desc: string;
  defaultRange: [number, number];
}

interface SpeedMathOperationTileProps {
  item: BasicOperation;
  activeSettingsTile: Operation | null;
  setActiveSettingsTile: (op: Operation | null) => void;
  getTileSetting: (op: Operation) => any;
  updateTileSettings: (op: Operation, settings: any) => void;
  handleStartBasic: (op: Operation) => void;
}

export function SpeedMathOperationTile({
  item,
  activeSettingsTile,
  setActiveSettingsTile,
  getTileSetting,
  updateTileSettings,
  handleStartBasic,
}: SpeedMathOperationTileProps) {
  return (
    <div
      className={`bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col gap-3 group relative ${activeSettingsTile === item.op ? "z-50" : ""}`}
    >
      <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
        {['sq', 'cube', 'frac', 'table'].includes(item.op) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateTileSettings(item.op, {
                isReverse: !getTileSetting(item.op).isReverse
              });
            }}
            className={`p-1.5 rounded-lg transition-colors ${getTileSetting(item.op).isReverse ? "text-indigo-500 dark:text-indigo-400" : "text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"}`}
            title="Reverse Type"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActiveSettingsTile(
              activeSettingsTile === item.op ? null : item.op,
            );
          }}
          className={`p-1.5 rounded-lg transition-colors ${activeSettingsTile === item.op ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" : "text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"}`}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {activeSettingsTile === item.op && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setActiveSettingsTile(null);
            }}
          />
          <div
            ref={(el) => {
              if (el && el.parentElement) {
                const rect = el.parentElement.getBoundingClientRect();
                const isLeft = rect.left < window.innerWidth / 2;
                if (isLeft) {
                  el.style.left = "16px";
                  el.style.right = "auto";
                  el.style.transformOrigin = "top left";
                } else {
                  el.style.right = "16px";
                  el.style.left = "auto";
                  el.style.transformOrigin = "top right";
                }
              }
            }}
            className="absolute top-[44px] right-4 z-50 w-[calc(100vw-2rem)] max-w-[300px] sm:w-[300px] bg-white dark:bg-[#131114] rounded-xl shadow-2xl border border-slate-200 dark:border-red-500/20 flex flex-col transform origin-top-right animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-slate-100 dark:border-red-500/10 flex justify-between items-center bg-transparent rounded-t-xl">
              <h3 className="font-semibold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                <Settings className="w-4 h-4" /> {item.name} Settings
              </h3>
              <button
                onClick={() => setActiveSettingsTile(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 hover:dark:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <OperationConfigurator
                operation={item.op}
                baseSettings={{
                  mode: getTileSetting(item.op).mode || "TIME",
                  duration: getTileSetting(item.op).duration ?? 60,
                  timeUnit: getTileSetting(item.op).timeUnit || "SEC",
                  questionCount:
                    getTileSetting(item.op).questionCount ?? 20,
                }}
                opSettings={{
                  difficulty:
                    getTileSetting(item.op).difficulty || "EASY",
                  customRanges:
                    getTileSetting(item.op).customRanges ?? "1-10",
                }}
                onChange={(base, op) => {
                  if (base) {
                    updateTileSettings(item.op, {
                      ...base,
                      ...op,
                      mode: base.mode || "TIME",
                    });
                  }
                }}
              />
            </div>
          </div>
        </>
      )}

      <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
        {item.icon}
      </div>
      <div>
        <h4 className="text-sm md:text-base font-medium text-slate-800 dark:text-slate-200">
          {item.name}
        </h4>
        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
          {item.desc}
        </p>
      </div>
      <button
        onClick={() => handleStartBasic(item.op)}
        className="mt-auto pt-4 flex items-center justify-between text-xs md:text-sm font-medium text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors"
      >
        <span>Start Practice</span>
        <Play className="w-4 h-4" />
      </button>
    </div>
  );
}
