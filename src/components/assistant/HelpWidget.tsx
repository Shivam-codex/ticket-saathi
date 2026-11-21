import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { MessageCircle, TicketCheck, X } from "lucide-react";
import { toast } from "sonner";
import { assistantPublicConfig } from "@/functions/trust.functions";
import { curatedAssistantAnswer } from "@/lib/assistant-fallback";
import { useI18n } from "@/lib/i18n";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ai-elements/shimmer";

export function HelpWidget() {
  const { t, lang: language } = useI18n(); const [open,setOpen] = useState(false); const [aiEnabled,setAiEnabled] = useState(false); const lastQuestion = useRef("");
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/public/assistant" }), []);
  const { messages, sendMessage, setMessages, status, stop, error, clearError } = useChat({ transport, onError: () => {
    const answer = curatedAssistantAnswer(lastQuestion.current,language);
    setMessages(current => [...current,{ id: `fallback-${Date.now()}`, role: "assistant", parts: [{ type: "text", text: answer }] }]);
    toast.error(t("assistant.fallback"));
  } });
  useEffect(() => { void assistantPublicConfig().then(c => setAiEnabled(c.enabled)).catch(() => setAiEnabled(false)); }, []);
  const submit = async ({ text }: { text: string }) => {
    if (!text.trim()) return; lastQuestion.current = text; clearError();
    if (!aiEnabled) {
      const now = Date.now(); const additions: UIMessage[] = [{ id:`user-${now}`,role:"user",parts:[{type:"text",text}] },{ id:`guide-${now}`,role:"assistant",parts:[{type:"text",text:curatedAssistantAnswer(text,language)}] }];
      setMessages(current => [...current,...additions]); return;
    }
    await sendMessage({ text });
  };
  return <><Button className="fixed bottom-24 right-4 z-40 h-12 rounded-full shadow-xl md:bottom-6" onClick={() => setOpen(v=>!v)} aria-label={t("assistant.open")}><MessageCircle className="h-5 w-5" />{t("assistant.open")}</Button>{open && <section className="fixed inset-x-3 bottom-36 z-40 flex h-[32rem] max-h-[65vh] flex-col overflow-hidden rounded-3xl border bg-card shadow-2xl md:inset-x-auto md:bottom-24 md:right-5 md:w-[25rem]" aria-label={t("assistant.title")}><header className="flex items-center justify-between border-b p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><TicketCheck className="h-5 w-5" /></span><div><h2 className="font-bold">{t("assistant.title")}</h2><p className="text-xs text-muted-foreground">{aiEnabled?t("assistant.ai"):t("assistant.curated")}</p></div></div><Button variant="ghost" size="icon" onClick={()=>setOpen(false)} aria-label={t("common.close")}><X className="h-4 w-4" /></Button></header><Conversation className="min-h-0 flex-1"><ConversationContent>{!messages.length&&<ConversationEmptyState icon={<TicketCheck className="h-8 w-8" />} title={t("assistant.welcome")} description={t("assistant.safety")} />}{messages.map(message=><Message key={message.id} from={message.role}><MessageContent>{message.parts.map((part,index)=>part.type==="text"?<MessageResponse key={index}>{part.text}</MessageResponse>:null)}</MessageContent></Message>)}{status==="submitted"&&<Shimmer>{t("assistant.thinking")}</Shimmer>}</ConversationContent><ConversationScrollButton /></Conversation>{error&&<p className="px-4 pb-2 text-xs text-muted-foreground">{t("assistant.fallback")}</p>}<PromptInput onSubmit={submit} className="border-t"><PromptInputTextarea placeholder={t("assistant.placeholder")} autoFocus /><PromptInputFooter><p className="px-3 text-[10px] text-muted-foreground">{t("assistant.temporary")}</p><PromptInputSubmit status={status} onStop={stop} /></PromptInputFooter></PromptInput></section>}</>;
}
