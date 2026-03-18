import React, { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Copy, Check, Share2, Mail, MessageCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ShareConfig {
  url?: string
  title?: string
  description?: string
  hashtags?: string[]
  via?: string
}

const DEFAULT_CONFIG: ShareConfig = {
  url: typeof window !== "undefined" ? window.location.href : "https://neuroquest.app",
  title: "NeuroQuest — Compassion Casino",
  description: "I'm training my mind & funding hunger relief with every spin. Your mind is the stake. The world is the winner.",
  hashtags: ["NeuroQuest", "CompassionCasino", "Neuroplasticity", "MindAndSpirit"],
  via: "NeuroQuestApp",
}

/* ── Platform definitions ─────────────────────────────────────────────── */
interface Platform {
  id: string
  name: string
  color: string
  bg: string
  border: string
  logo: React.ReactNode
  getUrl: (cfg: Required<ShareConfig>) => string | null
  action?: "copy" | "open"
  copyText?: (cfg: Required<ShareConfig>) => string
}

function XLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function FacebookLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function WhatsAppLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function LinkedInLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function RedditLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  )
}

function ThreadsLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.3-.883-2.342-.886l-.028-.001c-.8 0-2.07.208-2.748 1.896l-1.926-.666C5.765 5.592 7.565 4.68 9.283 4.68h.053c3.23.033 5.168 2.062 5.168 5.43 0 .406-.034.794-.1 1.16.695.195 1.314.517 1.84.965 1.063.904 1.685 2.22 1.853 3.925.318 3.24-1.223 5.745-4.199 6.946-1.122.45-2.35.674-3.712.694z"/>
    </svg>
  )
}

function TelegramLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

function TikTokLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  )
}

function PinterestLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  )
}

function DiscordLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.082.114 18.105.134 18.12a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

const PLATFORMS: Platform[] = [
  {
    id: "x",
    name: "X (Twitter)",
    color: "text-white",
    bg: "bg-black/60 hover:bg-black/80",
    border: "border-white/20 hover:border-white/40",
    logo: <XLogo size={15} />,
    getUrl: (cfg) => `https://x.com/intent/tweet?text=${encodeURIComponent(`${cfg.description}\n\n${cfg.url}`)}&hashtags=${cfg.hashtags.join(",")}&via=${cfg.via}`,
  },
  {
    id: "threads",
    name: "Threads",
    color: "text-white",
    bg: "bg-neutral-800/60 hover:bg-neutral-700/60",
    border: "border-white/15 hover:border-white/30",
    logo: <ThreadsLogo size={15} />,
    getUrl: (cfg) => `https://www.threads.net/intent/post?text=${encodeURIComponent(`${cfg.description} ${cfg.url} #${cfg.hashtags[0]}`)}`,
  },
  {
    id: "facebook",
    name: "Facebook",
    color: "text-white",
    bg: "bg-[#1877F2]/40 hover:bg-[#1877F2]/60",
    border: "border-[#1877F2]/40 hover:border-[#1877F2]/70",
    logo: <FacebookLogo size={15} />,
    getUrl: (cfg) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(cfg.url)}&quote=${encodeURIComponent(cfg.description)}`,
  },
  {
    id: "instagram",
    name: "Instagram",
    color: "text-white",
    bg: "bg-gradient-to-br from-purple-600/40 to-orange-400/40 hover:from-purple-600/60 hover:to-orange-400/60",
    border: "border-pink-400/30 hover:border-pink-400/60",
    logo: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
    getUrl: () => null,
    action: "copy",
    copyText: (cfg) => `${cfg.description} 🧠♡\n\nLink in bio or copy: ${cfg.url}\n\n#${cfg.hashtags.join(" #")}`,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    color: "text-white",
    bg: "bg-[#25D366]/30 hover:bg-[#25D366]/50",
    border: "border-[#25D366]/40 hover:border-[#25D366]/70",
    logo: <WhatsAppLogo size={15} />,
    getUrl: (cfg) => `https://api.whatsapp.com/send?text=${encodeURIComponent(`${cfg.title}\n\n${cfg.description}\n\n${cfg.url}`)}`,
  },
  {
    id: "telegram",
    name: "Telegram",
    color: "text-white",
    bg: "bg-[#229ED9]/30 hover:bg-[#229ED9]/50",
    border: "border-[#229ED9]/40 hover:border-[#229ED9]/60",
    logo: <TelegramLogo size={15} />,
    getUrl: (cfg) => `https://t.me/share/url?url=${encodeURIComponent(cfg.url)}&text=${encodeURIComponent(`${cfg.title} — ${cfg.description}`)}`,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    color: "text-white",
    bg: "bg-[#0077B5]/30 hover:bg-[#0077B5]/50",
    border: "border-[#0077B5]/40 hover:border-[#0077B5]/60",
    logo: <LinkedInLogo size={15} />,
    getUrl: (cfg) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(cfg.url)}&title=${encodeURIComponent(cfg.title)}&summary=${encodeURIComponent(cfg.description)}`,
  },
  {
    id: "reddit",
    name: "Reddit",
    color: "text-white",
    bg: "bg-[#FF4500]/25 hover:bg-[#FF4500]/45",
    border: "border-[#FF4500]/35 hover:border-[#FF4500]/60",
    logo: <RedditLogo size={15} />,
    getUrl: (cfg) => `https://www.reddit.com/submit?url=${encodeURIComponent(cfg.url)}&title=${encodeURIComponent(cfg.title)}`,
  },
  {
    id: "tiktok",
    name: "TikTok",
    color: "text-white",
    bg: "bg-black/50 hover:bg-black/70",
    border: "border-cyan-400/25 hover:border-cyan-400/50",
    logo: <TikTokLogo size={15} />,
    getUrl: () => null,
    action: "copy",
    copyText: (cfg) => `${cfg.description} 🧠✨\n\n${cfg.url}\n\n#${cfg.hashtags.join(" #")} #fyp #mindset`,
  },
  {
    id: "pinterest",
    name: "Pinterest",
    color: "text-white",
    bg: "bg-[#E60023]/25 hover:bg-[#E60023]/45",
    border: "border-[#E60023]/35 hover:border-[#E60023]/60",
    logo: <PinterestLogo size={15} />,
    getUrl: (cfg) => `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(cfg.url)}&description=${encodeURIComponent(`${cfg.title} — ${cfg.description}`)}`,
  },
  {
    id: "discord",
    name: "Discord",
    color: "text-white",
    bg: "bg-[#5865F2]/30 hover:bg-[#5865F2]/50",
    border: "border-[#5865F2]/40 hover:border-[#5865F2]/65",
    logo: <DiscordLogo size={15} />,
    getUrl: () => null,
    action: "copy",
    copyText: (cfg) => `**${cfg.title}** 🧠♡\n${cfg.description}\n\n${cfg.url}\n\n${cfg.hashtags.map(h => `#${h}`).join(" ")}`,
  },
  {
    id: "email",
    name: "Email",
    color: "text-white",
    bg: "bg-emerald-600/20 hover:bg-emerald-600/35",
    border: "border-emerald-500/30 hover:border-emerald-500/60",
    logo: <Mail size={15} />,
    getUrl: (cfg) => `mailto:?subject=${encodeURIComponent(cfg.title)}&body=${encodeURIComponent(`${cfg.description}\n\nExperience it here: ${cfg.url}`)}`,
  },
  {
    id: "sms",
    name: "SMS / iMessage",
    color: "text-white",
    bg: "bg-green-600/20 hover:bg-green-600/35",
    border: "border-green-500/30 hover:border-green-500/60",
    logo: <MessageCircle size={15} />,
    getUrl: (cfg) => `sms:?body=${encodeURIComponent(`${cfg.description} ${cfg.url}`)}`,
  },
]

/* ── SocialSharePanel ────────────────────────────────────────────────────── */
interface SocialSharePanelProps {
  config?: ShareConfig
  className?: string
  compact?: boolean
}

export function SocialSharePanel({ config = {}, className, compact = false }: SocialSharePanelProps) {
  const cfg: Required<ShareConfig> = {
    url: config.url ?? (typeof window !== "undefined" ? window.location.href : DEFAULT_CONFIG.url!),
    title: config.title ?? DEFAULT_CONFIG.title!,
    description: config.description ?? DEFAULT_CONFIG.description!,
    hashtags: config.hashtags ?? DEFAULT_CONFIG.hashtags!,
    via: config.via ?? DEFAULT_CONFIG.via!,
  }

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(cfg.url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
  }, [cfg.url])

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: cfg.title, text: cfg.description, url: cfg.url })
      } catch {}
    }
  }, [cfg])

  const handlePlatform = useCallback(async (p: Platform) => {
    const shareUrl = p.getUrl(cfg)
    if (shareUrl) {
      window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=480")
      return
    }
    if (p.action === "copy" && p.copyText) {
      await navigator.clipboard.writeText(p.copyText(cfg))
      setCopiedId(p.id)
      setTimeout(() => setCopiedId(null), 2500)
    }
  }, [cfg])

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share

  return (
    <div className={cn("space-y-4", className)}>
      {/* Native share + copy link row */}
      <div className="flex gap-2">
        {hasNativeShare && (
          <button
            onClick={handleNativeShare}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/15 border border-primary/35 hover:bg-primary/25 transition-all text-sm font-semibold text-primary"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        )}
        <button
          onClick={handleCopyLink}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-semibold",
            hasNativeShare ? "flex-1" : "w-full",
            linkCopied
              ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
              : "bg-white/5 border-white/15 hover:bg-white/10 text-white/70"
          )}
        >
          <AnimatePresence mode="wait">
            {linkCopied
              ? <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2"><Check className="w-4 h-4" /> Copied!</motion.span>
              : <motion.span key="copy" className="flex items-center gap-2"><Copy className="w-4 h-4" /> Copy Link</motion.span>
            }
          </AnimatePresence>
        </button>
      </div>

      {/* URL display */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/30 border border-white/8">
        <span className="text-xs text-white/30 truncate flex-1 font-mono">{cfg.url}</span>
      </div>

      {/* Platform grid */}
      <div className={cn("grid gap-2", compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => handlePlatform(p)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-xs font-semibold backdrop-blur-sm",
              p.bg, p.border, p.color,
              "hover:scale-[1.02] active:scale-[0.98]"
            )}
          >
            <span className="shrink-0">{p.logo}</span>
            <span className="truncate">
              {copiedId === p.id ? "Copied ✓" : compact ? p.name.split(" ")[0] : p.name}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-white/25 text-center leading-relaxed">
        © {new Date().getFullYear()} NeuroQuest™ — All Rights Reserved. Whitney Shauntaye, Creator.
        Sharing this content does not transfer intellectual property rights.
      </p>
    </div>
  )
}

/* ── Floating Share Button ───────────────────────────────────────────────── */
export function FloatingShareButton({ config }: { config?: ShareConfig }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-primary/90 border border-primary shadow-[0_0_24px_rgba(212,175,55,0.4)] backdrop-blur-sm text-sm font-bold text-[#1B3022]"
      >
        <Share2 className="w-4 h-4" />
        <span className="hidden sm:inline">Share</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0D1A10]/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
                <div>
                  <h2 className="font-serif font-bold text-lg text-primary">Share NeuroQuest</h2>
                  <p className="text-xs text-white/40 mt-0.5">Spread the Compassion Jackpot</p>
                </div>
                <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-white/8 transition-colors">
                  <X className="w-4 h-4 text-white/50" />
                </button>
              </div>
              <div className="p-6">
                <SocialSharePanel config={config} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
