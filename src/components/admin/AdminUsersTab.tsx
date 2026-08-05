import React, { useState } from "react";
import { UserProfile } from "../../types";
import { CustomDropdown } from "../CustomDropdown";
import {
  Search,
  Users,
  UserX,
  UserCheck,
  MessageSquareOff,
  MessageSquare,
} from "lucide-react";

interface AdminUsersTabProps {
  isOwner: boolean;
  loading: boolean;
  allAppUsers: UserProfile[];
  allFirebaseUsers: UserProfile[];
  bannedUsers: UserProfile[];
  mutedUsers: UserProfile[];
  muteDurationDays: number | string;
  setMuteDurationDays: (val: number | string) => void;
  saveSettings: () => void;
  expandedAdminId: string | null;
  setExpandedAdminId: (id: string | null) => void;
  adminListRef: React.RefObject<HTMLLIElement>;
  recalculatingUserIds: Set<string>;
  handleUpdateUserRole: (userId: string, role: string) => Promise<void>;
  handleUpdateUserStatus: (
    userId: string,
    updates: Partial<UserProfile>,
  ) => Promise<void>;
  handleRecalculateStats: (userId: string) => Promise<void>;
  handleTogglePermission: (user: UserProfile, perm: string) => void;
}

export function AdminUsersTab({
  isOwner,
  loading,
  allAppUsers,
  allFirebaseUsers,
  bannedUsers,
  mutedUsers,
  muteDurationDays,
  setMuteDurationDays,
  saveSettings,
  expandedAdminId,
  setExpandedAdminId,
  adminListRef,
  recalculatingUserIds,
  handleUpdateUserRole,
  handleUpdateUserStatus,
  handleRecalculateStats,
  handleTogglePermission,
}: AdminUsersTabProps) {
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"active" | "all">("active");

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-900 z-30 shrink-0">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200">
          User Management
        </h3>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoComplete="new-password"
            list="autocompleteOff"
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            type="text"
            placeholder="Search users..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full sm:w-[200px]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="max-w-4xl w-full mx-auto space-y-6">
          {loading ? (
            <div className="text-center py-4 text-slate-500 dark:text-slate-400">
              Loading users...
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <button
                    onClick={() => setUserFilter("active")}
                    className={`text-sm font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${userFilter === "active" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
                  >
                    <Users className="w-4 h-4" /> Active Users (
                    {allAppUsers.length})
                  </button>
                  {isOwner && (
                    <>
                      <button
                        onClick={() => setUserFilter("all")}
                        className={`text-sm font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${userFilter === "all" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`}
                      >
                        <Users className="w-4 h-4" /> All Users (
                        {allFirebaseUsers.length})
                      </button>
                    </>
                  )}
                </div>
                {(userFilter === "all" ? allFirebaseUsers : allAppUsers)
                  .filter(
                    (u) => isOwner || u.email !== "mrityunjoyk29@gmail.com",
                  )
                  .filter(
                    (u) =>
                      userSearch.trim() === "" ||
                      u.email
                        ?.toLowerCase()
                        .includes(userSearch.toLowerCase()) ||
                      (u as any).displayName
                        ?.toLowerCase()
                        .includes(userSearch.toLowerCase()),
                  ).length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                    No users found.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg overflow-visible w-full relative">
                    {[
                      ...(userFilter === "all"
                        ? allFirebaseUsers
                        : allAppUsers),
                    ]
                      .filter(
                        (u) => isOwner || u.email !== "mrityunjoyk29@gmail.com",
                      )
                      .filter(
                        (u) =>
                          userSearch.trim() === "" ||
                          u.email
                            ?.toLowerCase()
                            .includes(userSearch.toLowerCase()) ||
                          (u as any).displayName
                            ?.toLowerCase()
                            .includes(userSearch.toLowerCase()),
                      )
                      .sort((a, b) => {
                        const search = userSearch.toLowerCase().trim();
                        const nameA = (
                          (a as any).displayName ||
                          a.email ||
                          ""
                        ).toLowerCase();
                        const nameB = (
                          (b as any).displayName ||
                          b.email ||
                          ""
                        ).toLowerCase();
                        if (search) {
                          const aStarts = nameA.startsWith(search) ? 1 : 0;
                          const bStarts = nameB.startsWith(search) ? 1 : 0;
                          if (aStarts !== bStarts) return bStarts - aStarts;
                          return nameA.localeCompare(nameB);
                        }

                        const getMs = (val: any) => {
                          if (!val) return 0;
                          if (typeof val === "number") return val;
                          if (val.toMillis) return val.toMillis();
                          if (val.seconds) return val.seconds * 1000;
                          return new Date(val).getTime() || 0;
                        };

                        const aJoined = getMs((a as any).createdAt);
                        const bJoined = getMs((b as any).createdAt);
                        if (aJoined !== bJoined) return bJoined - aJoined;

                        const aActive = getMs(a.lastActiveAt);
                        const bActive = getMs(b.lastActiveAt);
                        return bActive - aActive;
                      })
                      .slice(0, 100)
                      .map((user) => (
                        <li
                          key={user.userId}
                          ref={
                            expandedAdminId === user.userId
                              ? adminListRef
                              : null
                          }
                          className={`p-3 bg-white dark:bg-slate-900 transition-colors first:rounded-t-lg last:rounded-b-lg ${user.role === "admin" ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" : ""}`}
                          onClick={(e) => {
                            if (
                              user.role === "admin" &&
                              expandedAdminId !== user.userId
                            ) {
                              setExpandedAdminId(user.userId);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  user.photoURL ||
                                  `https://ui-avatars.com/api/?name=${user.displayName}`
                                }
                                className="w-8 h-8 rounded-full object-cover"
                                alt=""
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                  {user.displayName}
                                </p>
                                {isOwner && (
                                  <>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {user.email || user.userId}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      Last active:{" "}
                                      {user.lastActiveAt
                                        ? new Date(
                                            user.lastActiveAt,
                                          ).toLocaleString()
                                        : "N/A"}
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isOwner &&
                                user.email !== "mrityunjoyk29@gmail.com" && (
                                  <CustomDropdown
                                    value={
                                      user.role === "admin" ? "Admin" : "User"
                                    }
                                    options={["User", "Admin"]}
                                    onChange={(val) =>
                                      handleUpdateUserRole(
                                        user.userId,
                                        val.toLowerCase(),
                                      )
                                    }
                                    placeholder="Role"
                                    buttonClassName="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold h-[26px] flex items-center justify-between"
                                    optionClassName="px-2 py-1 text-[11px]"
                                    className="w-[85px]"
                                  />
                                )}
                              {isOwner && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRecalculateStats(user.userId);
                                  }}
                                  disabled={recalculatingUserIds.has(
                                    user.userId,
                                  )}
                                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
                                    recalculatingUserIds.has(user.userId)
                                      ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-400"
                                  }`}
                                >
                                  {recalculatingUserIds.has(user.userId)
                                    ? "Updating..."
                                    : "Update"}
                                </button>
                              )}
                              {user.email !== "mrityunjoyk29@gmail.com" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateUserStatus(user.userId, {
                                      isMuted: true,
                                      mutedAt: new Date().getTime(),
                                    });
                                  }}
                                  className="text-xs font-medium px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/50 dark:hover:text-amber-400 rounded-md transition-colors flex items-center gap-1"
                                >
                                  Mute
                                </button>
                              )}
                              {isOwner &&
                                user.email !== "mrityunjoyk29@gmail.com" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateUserStatus(user.userId, {
                                        isBanned: true,
                                      });
                                    }}
                                    className="text-xs font-medium px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-900/50 dark:hover:text-rose-400 rounded-md transition-colors flex items-center gap-1"
                                  >
                                    Ban
                                  </button>
                                )}
                            </div>
                          </div>
                          {isOwner &&
                            user.role === "admin" &&
                            expandedAdminId === user.userId && (
                              <div
                                className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50 w-full animate-in slide-in-from-top-2 duration-200"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                                  Admin Permissions
                                </p>
                                <div className="flex flex-wrap gap-1.5 w-full">
                                  {[
                                    "canManageUsers",
                                    "canManageNotices",
                                    "canManageChallenges",
                                    "canManageLiveMocks",
                                    "canManageCountdowns",
                                    "canManageSettings",
                                    "canManageFeatures",
                                    "canManageQuotes",
                                    "canManageLearning",
                                    "canManageYpt",
                                  ].map((perm) => (
                                    <label
                                      key={perm}
                                      className={`text-[10px] flex items-center justify-center font-medium px-2 py-1 rounded-md cursor-pointer transition-colors border select-none ${!!(user.permissions as any)?.[perm] ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800/50 dark:text-indigo-300" : "bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                                    >
                                      <input
                                        autoComplete="new-password"
                                        list="autocompleteOff"
                                        data-1p-ignore="true"
                                        data-lpignore="true"
                                        data-form-type="other"
                                        type="checkbox"
                                        checked={
                                          !!(user.permissions as any)?.[perm]
                                        }
                                        onChange={() =>
                                          handleTogglePermission(user, perm)
                                        }
                                        className="sr-only"
                                      />
                                      {perm === "canManageYpt"
                                        ? "YPT"
                                        : perm.replace("canManage", "")}
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              {isOwner && (
                <div>
                  <h4 className="text-sm font-semibold text-rose-600 dark:text-rose-400 mb-3 flex items-center gap-1.5">
                    <UserX className="w-4 h-4" /> Banned Users (
                    {bannedUsers.length})
                  </h4>
                  {bannedUsers.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                      No banned users.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg overflow-visible w-full relative">
                      {bannedUsers.slice(0, 100).map((user) => (
                        <li
                          key={user.userId}
                          className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900 transition-colors first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                user.photoURL ||
                                `https://ui-avatars.com/api/?name=${user.displayName}`
                              }
                              className="w-8 h-8 rounded-full object-cover"
                              alt=""
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                {user.displayName}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {user.email || user.userId}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Last active:{" "}
                                {user.lastActiveAt
                                  ? new Date(user.lastActiveAt).toLocaleString()
                                  : "N/A"}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleUpdateUserStatus(user.userId, {
                                isBanned: false,
                              })
                            }
                            className="text-xs font-medium px-3 py-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-md transition-colors flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Unban
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <MessageSquareOff className="w-4 h-4" /> Muted Users (
                    {
                      mutedUsers.filter(
                        (u) =>
                          isOwner ||
                          (u.email !== "mrityunjoyk29@gmail.com" &&
                            u.mutedAt &&
                            (new Date().getTime() - u.mutedAt) /
                              (1000 * 60 * 60 * 24) <=
                              (Number(muteDurationDays) || 1)),
                      ).length
                    }
                    )
                  </h4>
                  {isOwner && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Duration (Days):
                      </label>
                      <input
                        autoComplete="new-password"
                        list="autocompleteOff"
                        data-1p-ignore="true"
                        data-lpignore="true"
                        data-form-type="other"
                        type="number"
                        min="1"
                        value={muteDurationDays}
                        onChange={(e) =>
                          setMuteDurationDays(
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value),
                          )
                        }
                        onBlur={saveSettings}
                        className="w-16 px-2 py-1 border border-slate-200 dark:border-slate-700/50 rounded-md text-xs bg-slate-50 dark:bg-slate-800/50 dark:text-slate-200"
                      />
                    </div>
                  )}
                </div>
                {mutedUsers.filter(
                  (u) =>
                    isOwner ||
                    (u.email !== "mrityunjoyk29@gmail.com" &&
                      u.mutedAt &&
                      (new Date().getTime() - u.mutedAt) /
                        (1000 * 60 * 60 * 24) <=
                        (Number(muteDurationDays) || 1)),
                ).length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                    No muted users.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-200 dark:border-slate-800/50 rounded-lg overflow-visible w-full relative">
                    {mutedUsers
                      .filter(
                        (u) =>
                          isOwner ||
                          (u.email !== "mrityunjoyk29@gmail.com" &&
                            u.mutedAt &&
                            (new Date().getTime() - u.mutedAt) /
                              (1000 * 60 * 60 * 24) <=
                              (Number(muteDurationDays) || 1)),
                      )
                      .slice(0, 100)
                      .map((user) => (
                        <li
                          key={user.userId}
                          className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 bg-white dark:bg-slate-900 transition-colors first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                user.photoURL ||
                                `https://ui-avatars.com/api/?name=${user.displayName}`
                              }
                              className="w-8 h-8 rounded-full object-cover"
                              alt=""
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                {user.displayName}
                              </p>
                              {isOwner && (
                                <>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {user.email || user.userId}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    Last active:{" "}
                                    {user.lastActiveAt
                                      ? new Date(
                                          user.lastActiveAt,
                                        ).toLocaleString()
                                      : "N/A"}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleUpdateUserStatus(user.userId, {
                                isMuted: false,
                              })
                            }
                            className="text-xs font-medium px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-md transition-colors flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Unmute
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
