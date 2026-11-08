import React from 'react';
import { UserProfile } from '../../types';
import { Card } from '../ui/Card';
import { useCommunityView } from './CommunityContext';

export function CommunityChat() {
  const { MessageSquare, chatMessages, Pin, handlePinMessage, X, setActiveMsgId, setCustomEmojiOpenForId, setActiveReactionView, setActiveActionsMsgId, setShowPollVotersForId, userMap, user, activeActionsMsgId, setReplyingTo, activeMsgId, handlePollVote, CheckCircle2, CheckSquare, showPollVotersForId, activeReactionView, handleChatReact, customEmojiOpenForId, customEmojiInput, setCustomEmojiInput, setEditingMessageId, setNewMessage, setShowPollMaker, setPollQuestion, setPollIsMulti, setPollOptions, Pencil, isAdmin, handleDeleteMessage, Trash2, PinOff, chatBottomRef, chatError, replyingTo, handleSendMessage, editingMessageId, showPollMaker, BarChart2, pollIsMulti, pollQuestion, pollOptions, newMessage, isSending, Send } = useCommunityView();

  const handleScrollToPinnedMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleChatBackgroundClick = () => {
    setActiveMsgId(null);
    setCustomEmojiOpenForId(null);
    setActiveReactionView(null);
    setActiveActionsMsgId(null);
    setShowPollVotersForId(null);
  };

  const handleToggleReactionView = (msgId: string) => {
    if (activeReactionView === msgId) {
      setActiveReactionView(null);
    } else {
      setActiveReactionView(msgId);
    }
  };

  const handleRemoveReaction = (msgId: string, emoji: string) => {
    handleChatReact(msgId, emoji);
    setActiveReactionView(null);
  };

  const handleQuickReact = (msgId: string, emoji: string) => {
    handleChatReact(msgId, emoji);
    setActiveMsgId(null);
  };

  const handleOpenCustomEmoji = (msgId: string) => {
    setCustomEmojiOpenForId(msgId);
    setCustomEmojiInput("");
  };

  const handleCancelEditing = () => {
    setEditingMessageId(null);
    setNewMessage("");
  };

  const handleTogglePollOptionCorrectness = (optId: string) => {
    if (!pollIsMulti) {
       setPollOptions(pollOptions.map(o => ({ ...o, isCorrect: o.id === optId ? !o.isCorrect : false })));
    } else {
       setPollOptions(pollOptions.map(o => o.id === optId ? { ...o, isCorrect: !o.isCorrect } : o));
    }
  };

  return <>
    {/* CHAT SECTION */}
      <Card id="community-chat" noPadding className="border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col h-[550px]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 shrink-0">
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" /> Community Chat
          </h3>
          <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded w-fit shrink-0 whitespace-nowrap">Auto deletes after 48h</span>
        </div>
        
        {chatMessages.filter(m => m.isPinned).length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-100 dark:border-amber-900 px-4 py-2 flex flex-col gap-1 max-h-24 overflow-y-auto custom-scrollbar">
            {chatMessages.filter(m => m.isPinned).map(msg => (
               <div key={`pin-${msg.id}`} className="flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
                  <div className="flex items-center gap-2 overflow-hidden cursor-pointer" onClick={() => handleScrollToPinnedMessage(msg.id)}>
                     <Pin className="w-3.5 h-3.5 shrink-0" />
                     <span className="truncate opacity-90">{msg.text || (msg.poll ? `📊 ${msg.poll.question}` : '')}</span>
                  </div>
                  <button onClick={() => handlePinMessage(msg.id, true)} className="p-1 hover:bg-amber-200 dark:hover:bg-amber-800 rounded text-amber-700 dark:text-amber-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
               </div>
            ))}
          </div>
        )}

        <div 
          id="community-chat-scroll" 
          className="flex-1 p-4 overflow-y-auto overflow-x-hidden space-y-4 custom-scrollbar bg-slate-50/30 dark:bg-slate-900/30"
          onClick={handleChatBackgroundClick}
        >
          {chatMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Say hi to everyone!</div>
          ) : (
            chatMessages.map(msg => {
              const uProfile = userMap[msg.userId] || {} as Partial<UserProfile>;
              const displayName = msg.userId === user?.uid ? 'You' : (uProfile.displayName || msg.userName);
              const photoURL = uProfile.photoURL || msg.userPhoto;
              const isOnlyPoll = msg.poll && (!msg.text || msg.text === '📊 Poll');
              return (
                <div 
                  key={msg.id}
                  className={`w-full flex ${msg.userId === user?.uid ? 'justify-end' : 'justify-start'}`}
                  onClick={(e) => { e.stopPropagation(); setActiveActionsMsgId(activeActionsMsgId === msg.id ? null : msg.id); setActiveMsgId(null); setActiveReactionView(null); setCustomEmojiOpenForId(null); setShowPollVotersForId(null); }}
                >
                  <div 
                    id={`msg-${msg.id}`}
                    className={`flex sm:gap-3 max-w-[95%] sm:max-w-[85%] ${msg.userId === user?.uid ? 'sm:flex-row-reverse' : ''}`}
                    onClick={(e) => {
                       // We can't use drag events easily, so just keep normal click behavior. 
                       // Swipe to reply logic is lost but we have action menus for reply.
                    }}
                  >
                  <img src={photoURL || `https://ui-avatars.com/api/?name=${uProfile?.displayName || msg.userName || 'U'}`} alt="" className="hidden sm:block w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-200 object-cover pointer-events-none mt-1 sm:mt-0" />
                  <div className={`flex flex-col gap-1 w-full max-w-full ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-1.5 ${msg.userId === user?.uid ? 'flex-row-reverse sm:flex-row' : ''}`}>
                      <img src={photoURL || `https://ui-avatars.com/api/?name=${uProfile?.displayName || msg.userName || 'U'}`} alt="" className="sm:hidden w-5 h-5 rounded-full border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-200 object-cover pointer-events-none" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{displayName}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(msg.createdAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div 
                      className={`relative px-4 py-2 text-sm rounded-2xl ${msg.userId === user?.uid ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-600 shadow-sm rounded-tl-sm'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMsgId(activeMsgId === msg.id ? null : msg.id);
                        setActiveActionsMsgId(null);
                        setActiveReactionView(null);
                        setCustomEmojiOpenForId(null);
                        setShowPollVotersForId(null);
                      }}
                    >
                      {msg.replyTo && (
                        <div 
                          className={`mb-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer relative overflow-hidden ${msg.userId === user?.uid ? 'bg-indigo-700/40 text-indigo-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                          onClick={(e) => {
                             e.stopPropagation();
                             const el = document.getElementById(`msg-${msg.replyTo.id}`);
                             if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                             setShowPollVotersForId(null);
                          }}
                        >
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${msg.userId === user?.uid ? 'bg-indigo-400' : 'bg-slate-300 dark:bg-slate-500'}`}></div>
                          <div className="font-semibold">{msg.replyTo.userName}</div>
                          <div className="truncate opacity-90">{msg.replyTo.text}</div>
                        </div>
                      )}
                      {msg.text !== '📊 Poll' && <span className="whitespace-pre-wrap break-words">{msg.text}</span>}
                      {msg.isEdited && <span className="text-[10px] opacity-70 ml-2">(edited)</span>}
                      
                      {msg.poll && (
                        <div className={`${isOnlyPoll ? '' : 'mt-2'}`}>
                          <div className={`font-bold flex items-center gap-1.5 mb-2 leading-tight text-base ${msg.userId === user?.uid ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                            <span>{msg.poll.question}</span> 
                          </div>
                          <div className="space-y-1.5">
                            {msg.poll.options.map((opt: any) => {
                               const voteCount = Object.keys(opt.votes || {}).length;
                               const hasVoted = user && opt.votes && opt.votes[user.uid];
                               const totalVotes = msg.poll.options.reduce((acc: number, o: any) => acc + Object.keys(o.votes || {}).length, 0);
                               const percent = totalVotes === 0 ? 0 : Math.round((voteCount / totalVotes) * 100);
                               const hasCorrectOption = msg.poll.options.some((o:any) => o.isCorrect);
                               const userHasVotedAny = msg.poll.options.some((o:any) => o.votes && o.votes[user?.uid!]);
                               
                               let optionBg = msg.userId === user?.uid ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600';
                               if (hasVoted) optionBg = 'bg-blue-500 dark:bg-blue-600';
                               if (hasCorrectOption && userHasVotedAny) {
                                 if (opt.isCorrect) optionBg = 'bg-emerald-500 dark:bg-emerald-600';
                                 else if (hasVoted) optionBg = 'bg-red-500 dark:bg-red-600';
                               }

                               const showCorrect = hasCorrectOption && userHasVotedAny && opt.isCorrect;
                               const showIncorrect = hasCorrectOption && userHasVotedAny && hasVoted && !opt.isCorrect;

                               return (
                                <button
                                  key={opt.id}
                                  disabled={!user}
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handlePollVote(msg.id, opt.id); 
                                    setActiveMsgId(null); 
                                    setCustomEmojiOpenForId(null); 
                                    setActiveReactionView(null); 
                                    setActiveActionsMsgId(null);
                                    setShowPollVotersForId(null);
                                  }}
                                  className={`relative w-full text-left overflow-hidden rounded-md px-2 py-1.5 transition-colors ${msg.userId === user?.uid ? 'hover:bg-indigo-600/50' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                >
                                   <div className={`absolute top-0 bottom-0 left-0 ${optionBg} opacity-20`} style={{ width: `${userHasVotedAny ? percent : 0}%` }}></div>
                                   <div className="relative flex justify-between items-center gap-2">
                                     <span className="flex items-center gap-1.5 text-sm">
                                       {showCorrect ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" /> : hasVoted ? <CheckSquare className="w-3.5 h-3.5 opacity-80 shrink-0" /> : <div className="w-3.5 h-3.5 border border-current rounded-sm opacity-40 shrink-0" />} 
                                       <span className={showCorrect ? 'font-bold text-emerald-600 dark:text-emerald-400' : (showIncorrect ? 'text-red-500 dark:text-red-400 line-through' : '')}>{opt.text}</span>
                                     </span>
                                     <span className="text-xs font-mono opacity-80 w-8 text-right shrink-0">{userHasVotedAny ? `${percent}%` : ''}</span>
                                   </div>
                                 </button>
                               )
                            })}
                          </div>
                          <div className="relative">
                            <div 
                              className="text-[10px] text-right mt-1.5 opacity-70 cursor-pointer hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowPollVotersForId(showPollVotersForId === msg.id ? null : msg.id);
                                setActiveMsgId(null);
                                setCustomEmojiOpenForId(null);
                                setActiveActionsMsgId(null);
                                setActiveReactionView(null);
                              }}
                            >
                              {msg.poll.options.reduce((acc: number, o: any) => acc + Object.keys(o.votes || {}).length, 0)} votes
                            </div>
                            {showPollVotersForId === msg.id && (
                              <div className={`absolute top-6 w-64 ${msg.userId === user?.uid ? 'right-0' : 'left-0'} max-w-[calc(100vw-3rem)] sm:max-w-none bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-[60] p-3 max-h-60 overflow-y-auto custom-scrollbar`} onClick={e => e.stopPropagation()}>
                                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-2">Voters</h4>
                                {msg.poll.options.map((opt: any) => {
                                   const voters = Object.entries(opt.votes || {});
                                   if (voters.length === 0) return null;
                                   return (
                                     <div key={opt.id} className="mb-3 last:mb-0">
                                       <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase truncate">{opt.text}</div>
                                       <div className="space-y-1.5">
                                         {voters.map(([uid, voteData]: [string, any]) => {
                                            const voterProfile = userMap[uid];
                                            const timestampMs = voteData?.timestamp || null;
                                            const dateStr = timestampMs ? new Date(timestampMs).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                                            
                                            return (
                                              <div key={uid} className="flex items-center gap-2">
                                                 <img src={voterProfile?.photoURL || `https://ui-avatars.com/api/?name=${voterProfile?.displayName || 'User'}`} className="w-5 h-5 rounded-full object-cover bg-slate-100 dark:bg-slate-700" alt="" />
                                                 <div className="flex flex-col min-w-0">
                                                   <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{voterProfile?.displayName || 'Unknown User'}</span>
                                                   {dateStr && <span className="text-[8px] sm:text-[9px] text-slate-400 dark:text-slate-500">{dateStr}</span>}
                                                 </div>
                                              </div>
                                            );
                                         })}
                                       </div>
                                     </div>
                                   );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {msg.reactions && Object.keys(msg.reactions).some(k => Object.keys(msg.reactions[k]).length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1.5 relative" onClick={e => { e.stopPropagation(); setActiveMsgId(null); setCustomEmojiOpenForId(null); setActiveActionsMsgId(null); setShowPollVotersForId(null); }}>
                          {Object.entries(msg.reactions).map(([emoji, votes]: [string, any]) => {
                             const cnt = Object.keys(votes).length;
                             if (cnt === 0) return null;
                             const hasVoted = user && votes[user.uid];
                             return (
                               <button
                                 key={emoji}
                                 onClick={() => handleToggleReactionView(msg.id)}
                                 className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs shadow-sm transition-colors ${hasVoted ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
                               >
                                 <span>{emoji}</span><span>{cnt}</span>
                               </button>
                             )
                          })}
                          {activeReactionView === msg.id && (
                            <div className={`absolute top-full ${msg.userId === user?.uid ? 'right-0' : 'left-0'} mt-1 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2`} onClick={e => e.stopPropagation()}>
                              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Reactions</span>
                                <button onClick={() => setActiveReactionView(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"><X className="w-3 h-3"/></button>
                              </div>
                              <div className="max-h-40 overflow-y-auto custom-scrollbar p-1">
                                {Object.entries(msg.reactions).flatMap(([reactEmoji, reactVotes]: [string, any]) => 
                                  Object.keys(reactVotes).map(uid => {
                                    const profile = userMap[uid];
                                    const isMe = user?.uid === uid;
                                    return (
                                      <div key={`${reactEmoji}-${uid}`} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:bg-slate-700/50">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                          <div className="relative shrink-0">
                                            <img src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || 'U'}`} alt="" className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-700" />
                                            <span className="absolute -bottom-1 -right-1 text-[10px] bg-white dark:bg-slate-800 rounded-full shadow-sm">{reactEmoji}</span>
                                          </div>
                                          <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{isMe ? 'You' : (profile?.displayName || 'Anonymous')}</span>
                                        </div>
                                        {isMe && (
                                          <button onClick={() => handleRemoveReaction(msg.id, reactEmoji)} className="text-[10px] text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 px-2 py-1 rounded transition-colors font-medium">Remove</button>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeMsgId === msg.id && (
                        <div className={`absolute -top-12 ${msg.userId === user?.uid ? 'right-0' : 'left-0'} bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 flex items-center gap-2 z-50 animate-in slide-in-from-bottom-2 fade-in whitespace-nowrap`} onClick={e => e.stopPropagation()}>
                          {['👍', '👎', '❤️', '🔥', '😕'].map(emoji => (
                             <button
                               key={emoji}
                               onClick={() => handleQuickReact(msg.id, emoji)}
                               className="text-xl hover:scale-125 transition-transform origin-bottom"
                             >
                               {emoji}
                             </button>
                          ))}
                          <div className="w-[1px] h-5 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                          {customEmojiOpenForId === msg.id ? (
                            <form onSubmit={(e) => {
                               e.preventDefault();
                               if (customEmojiInput.trim()) {
                                 handleChatReact(msg.id, customEmojiInput.trim());
                               }
                               setCustomEmojiOpenForId(null);
                               setCustomEmojiInput('');
                               setActiveMsgId(null);
                            }} className="flex items-center gap-1">
                              <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" 
                                type="text"
                                autoFocus
                                value={customEmojiInput}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val.length <= 4) setCustomEmojiInput(val);
                                }}
                                className="w-10 px-1 py-0.5 text-center bg-slate-100 dark:bg-slate-900 border-none rounded text-lg focus:ring-1 focus:ring-indigo-500 custom-scrollbar"
                                placeholder="..." 
                              />
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenCustomEmoji(msg.id)}
                              className="text-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors w-6 h-6 flex items-center justify-center font-bold"
                            >
                              +
                            </button>
                          )}
                        </div>
                      )}

                      {/* Action buttons wrapper */}
                      <div className={`absolute top-1/2 -translate-y-1/2 transition-opacity flex items-center gap-1.5 z-10 ${activeActionsMsgId === msg.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} ${msg.userId === user?.uid ? '-left-[4.5rem]' : '-right-[4.5rem]'}`}>
                         {msg.userId === user?.uid && (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setEditingMessageId(msg.id); 
                                setNewMessage(msg.text === '📊 Poll' ? '' : msg.text);
                                if (msg.poll) {
                                  setShowPollMaker(true);
                                  setPollQuestion(msg.poll.question || '');
                                  setPollIsMulti(msg.poll.isMulti || false);
                                  let opts = [...msg.poll.options];
                                  while (opts.length < 2) opts.push({ id: Math.random().toString(), text: '', isCorrect: false, votes: {} });
                                  setPollOptions(opts);
                                } else {
                                  setShowPollMaker(false);
                                  setPollQuestion('');
                                  setPollOptions([{id: '1', text: '', isCorrect: false}, {id: '2', text: '', isCorrect: false}]);
                                  setPollIsMulti(false);
                                }
                                setActiveActionsMsgId(null);
                                setReplyingTo(null);
                              }} 
                              className={`p-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full shadow-sm hover:scale-110`} 
                              title="Edit message"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                         )}
                         {(msg.userId === user?.uid || isAdmin) && (
                         <button 
                           onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDeleteMessage(msg.id, msg.userId); 
                              setActiveActionsMsgId(null);
                           }} 
                           className={`p-1.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full shadow-sm hover:scale-110`} 
                           title="Delete message"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                         )}
                           <button 
                             onClick={(e) => { 
                                e.stopPropagation(); 
                                handlePinMessage(msg.id, msg.isPinned === true); 
                                setActiveActionsMsgId(null);
                             }} 
                             className={`p-1.5 ${msg.isPinned ? 'bg-amber-500 text-white' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'} rounded-full shadow-sm hover:scale-110`} 
                             title={msg.isPinned ? "Unpin message" : "Pin message"}
                           >
                             {msg.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                           </button>
                      </div>
                    </div>
                </div>
              </div>
                </div>
            );
          })
          )}
          <div ref={chatBottomRef} />
        </div>
        <div className="relative">
          {chatError && (
             <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-red-100 dark:bg-red-900/90 text-red-600 dark:text-red-200 px-4 py-2 rounded-lg text-sm font-medium z-10 whitespace-nowrap shadow-md">
               {chatError}
             </div>
          )}
          {replyingTo && (
            <div className="absolute bottom-full mb-0 w-full left-0 bg-slate-100/90 dark:bg-slate-800/90  border-t border-slate-200 dark:border-slate-700 p-2.5 px-4 flex justify-between items-center z-10 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-indigo-500">
              <div className="flex flex-col text-xs pr-4 overflow-hidden">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  Replying to {replyingTo.userId === user?.uid ? 'You' : (userMap[replyingTo.userId]?.displayName || replyingTo.userName)}
                </span>
                <span className="text-slate-600 dark:text-slate-300 truncate mt-0.5">{replyingTo.text}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setReplyingTo(null)} 
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 dark:hover:text-slate-300 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <form onSubmit={handleSendMessage} className={`p-3 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-end gap-2 ${replyingTo ? 'pt-2' : ''} relative`}>
            {editingMessageId ? (
               <button type="button" onClick={handleCancelEditing} className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                 <X className="w-5 h-5" />
               </button>
            ) : (
               <button type="button" onClick={() => setShowPollMaker(!showPollMaker)} className={`p-2.5 rounded-xl transition-colors ${showPollMaker ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                 <BarChart2 className="w-5 h-5" />
               </button>
            )}

            {showPollMaker && (
              <div className="absolute bottom-full left-0 right-0 mb-2 mx-3 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 fade-in z-20">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" type="checkbox" checked={pollIsMulti} onChange={e => setPollIsMulti(e.target.checked)} className="rounded text-indigo-600 cursor-pointer" /> Multi-select
                    </label>
                  </div>
                  <button type="button" onClick={() => setShowPollMaker(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X className="w-4 h-4"/></button>
                </div>
                <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" 
                  type="text" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full mb-3 px-3 py-2 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 font-medium"
                />
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {pollOptions.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-0">
                       <button
                         type="button"
                         onClick={() => handleTogglePollOptionCorrectness(opt.id)}
                         className={`p-1.5 rounded-md transition-colors ${opt.isCorrect ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40' : 'text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                         title="Mark as correct option"
                       >
                         <CheckCircle2 className="w-4 h-4" />
                       </button>
                       <input  autoComplete="new-password" list="autocompleteOff"   data-1p-ignore="true" data-lpignore="true" data-form-type="other" 
                         type="text" value={opt.text} onChange={e => setPollOptions(pollOptions.map(o => o.id === opt.id ? { ...o, text: e.target.value } : o))}
                         placeholder={`Option ${i+1}`}
                         className="flex-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                       />
                       {pollOptions.length > 2 && (
                         <button type="button" onClick={() => setPollOptions(pollOptions.filter(o => o.id !== opt.id))} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                       )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 10 && (
                  <button type="button" onClick={() => setPollOptions([...pollOptions, {id: Math.random().toString(), text:'', isCorrect:false}])} className="mt-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors inline-block px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30">+ Add Option</button>
                )}
              </div>
            )}
            <textarea  data-1p-ignore="true" data-lpignore="true" data-form-type="other"
              name="chatMsg"
              id="chatMsg"
              maxLength={2000}
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                    // Just let it add a new line, don't prevent default.
                    // Wait, inside a Enter in textarea does NOT submit by default.
                 }
              }}
              placeholder={editingMessageId ? "Edit message..." : (user ? "Type a message..." : "Sign in to chat")}
              disabled={!user || isSending}
              className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-slate-800 dark:text-slate-200 resize-none min-h-[40px] max-h-[120px] overflow-y-auto"
              rows={1}
              onInput={(e) => {
                 const target = e.target as HTMLTextAreaElement;
                 target.style.height = 'auto';
                 target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <button 
              type="submit" 
              disabled={!user || (!newMessage.trim() && (!showPollMaker || !pollQuestion.trim() || pollOptions.filter(o => o.text.trim()).length < 2)) || isSending}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </Card>
  </>
}
