// Investor-grade dummy data — no backend dependency.
import { colors } from "./theme";

export type Skill = { name: string; level: "Beginner" | "Good" | "Expert"; verified?: boolean };
export type DummyUser = {
  id: string;
  name: string;
  city: string;
  avatar: string;
  offered: Skill[];
  needed: Skill[];
  swap_score: number;
  swaps_completed: number;
  people_helped: number;
  response_time_mins: number;
  is_pro: boolean;
  match_pct: number;
  distance_km: number;
  reason?: string;
};

export const ME = {
  name: "Aarav Khanna",
  city: "Mumbai · Bandra West",
  member_since: "Jan 2026",
  avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=400&q=80",
  swap_score: 847,
  delta_week: 28,
  swaps_completed: 12,
  people_helped: 17,
  skills_exchanged: 6,
  is_pro: true,
  delivery: 96,
  quality: 92,
  comms: 88,
  offered: [
    { name: "Logo Design", level: "Expert" as const, verified: true },
    { name: "Brand Identity", level: "Expert" as const, verified: true },
    { name: "Illustration", level: "Good" as const },
  ],
  needed: [
    { name: "GST Filing", level: "Good" as const },
    { name: "Tax Consulting", level: "Good" as const },
  ],
};

export const HISTORY = [
  {
    id: "h1",
    name: "Ankit Verma",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&q=80",
    gave: "Logo Design",
    got: "GST Filing",
    rating: 5,
    when: "2 hafte pehle",
    verified: true,
  },
  {
    id: "h2",
    name: "Priya Sharma",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&q=80",
    gave: "Brand Identity",
    got: "Yoga Coaching",
    rating: 5,
    when: "1 mahina pehle",
    verified: true,
  },
  {
    id: "h3",
    name: "Karan Singh",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80",
    gave: "Illustration",
    got: "Web Design",
    rating: 4,
    when: "2 mahine pehle",
    verified: false,
  },
];

export const FEED: DummyUser[] = [
  {
    id: "u1",
    name: "Priya Sharma",
    city: "Mumbai",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
    offered: [
      { name: "Yoga Coaching", level: "Expert", verified: true },
      { name: "Nutrition Plan", level: "Good" },
    ],
    needed: [{ name: "Logo Design", level: "Good" }],
    swap_score: 892,
    swaps_completed: 14,
    people_helped: 21,
    response_time_mins: 12,
    is_pro: true,
    match_pct: 98,
    distance_km: 2.3,
    reason:
      "Priya ko exactly logo design chahiye — tumhara strongest skill. Tum bhi yoga learn karna chahte the. Bilkul fit match.",
  },
  {
    id: "u2",
    name: "Ankit Verma",
    city: "Delhi",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80",
    offered: [
      { name: "Tax Consulting", level: "Expert", verified: true },
      { name: "GST Filing", level: "Expert", verified: true },
    ],
    needed: [
      { name: "Logo Design", level: "Good" },
      { name: "Social Media", level: "Good" },
    ],
    swap_score: 901,
    swaps_completed: 23,
    people_helped: 31,
    response_time_mins: 18,
    is_pro: true,
    match_pct: 94,
    distance_km: 8.7,
    reason:
      "Ankit ek CA hai jo logo + social media chahta hai. Tumhe GST + tax help chahiye — perfect 2-way swap.",
  },
  {
    id: "u3",
    name: "Karan Singh",
    city: "Bengaluru",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
    offered: [
      { name: "Web Design", level: "Expert", verified: true },
      { name: "React Development", level: "Expert" },
    ],
    needed: [{ name: "Logo Design", level: "Good" }],
    swap_score: 856,
    swaps_completed: 14,
    people_helped: 19,
    response_time_mins: 24,
    is_pro: false,
    match_pct: 87,
    distance_km: 4.2,
    reason:
      "Karan ki agency ko logo chahiye, aur tumhare portfolio ke liye unka React skill kaam aayega.",
  },
  {
    id: "u4",
    name: "Aisha Khan",
    city: "Hyderabad",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80",
    offered: [
      { name: "Video Editing", level: "Expert" },
      { name: "Reels Creation", level: "Expert", verified: true },
    ],
    needed: [{ name: "Brand Identity", level: "Good" }],
    swap_score: 815,
    swaps_completed: 11,
    people_helped: 17,
    response_time_mins: 30,
    is_pro: false,
    match_pct: 82,
    distance_km: 12.5,
    reason: "Aisha brand reels banati hai but apne brand ke liye identity chahiye.",
  },
  {
    id: "u5",
    name: "Sneha Iyer",
    city: "Pune",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80",
    offered: [
      { name: "Content Writing", level: "Expert", verified: true },
      { name: "SEO", level: "Good" },
    ],
    needed: [{ name: "Illustration", level: "Good" }],
    swap_score: 768,
    swaps_completed: 7,
    people_helped: 11,
    response_time_mins: 45,
    is_pro: false,
    match_pct: 76,
    distance_km: 6.8,
    reason: "Sneha ki blog ko illustrations chahiye, aur tumhe SEO help chahiye website ke liye.",
  },
  {
    id: "u6",
    name: "Vikram Patel",
    city: "Ahmedabad",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
    offered: [
      { name: "Legal Advice", level: "Expert", verified: true },
      { name: "Contract Drafting", level: "Expert" },
    ],
    needed: [{ name: "Logo Design", level: "Good" }],
    swap_score: 882,
    swaps_completed: 15,
    people_helped: 22,
    response_time_mins: 22,
    is_pro: false,
    match_pct: 71,
    distance_km: 18.4,
    reason: "Vikram ki law firm ko branding chahiye — tum logo design provide kar sakte ho.",
  },
];

export const CATEGORY_COLORS: Record<string, string> = {
  All: colors.brand,
  Tech: "#5B8DEF",
  Design: colors.brand,
  Finance: colors.teal,
  Education: "#B47CFF",
  Legal: "#FFB800",
  Home: "#FF6B6B",
  Health: "#00C896",
};
