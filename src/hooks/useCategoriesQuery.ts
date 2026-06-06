import useSWR from "swr";
import { collection, query, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { ExamCategory } from "../types";

const DefaultBanking: ExamCategory = {
  id: "banking",
  name: "Banking",
  exams: ["SBI", "IBPS", "RRB", "LIC", "NICL", "NIACL", "RBI", "NABARD", "CGL"],
  roles: ["PO", "Clerk", "AO", "AAO", "Assistant"],
  phases: ["Prelims", "Mains"],
  scopes: ["Full", "Sectional"],
  platforms: [
    "Oliveboard",
    "Practice Mock",
    "Smartkeeda",
    "Testbook",
    "Guidely",
    "Yes Mock",
    "Adda",
    "Learning niti",
  ],
  subjects: [
    { id: "bank_quant", name: "Quant" },
    { id: "bank_reasoning", name: "Reasoning" },
    { id: "bank_english", name: "English" },
    { id: "bank_ga", name: "GA" },
    { id: "bank_computer", name: "Computer" },
  ],
};

async function fetchCategories() {
  const categoriesSnap = await getDocs(query(collection(db, "categories")));
  let fetchedCategories: ExamCategory[] = [];
  let hasBanking = false;

  categoriesSnap.forEach((d) => {
    const catData = { id: d.id, ...d.data() } as ExamCategory;
    if (d.id === "banking") hasBanking = true;
    fetchedCategories.push(catData);
  });

  if (!hasBanking) {
    fetchedCategories.push(DefaultBanking);
  }

  return fetchedCategories;
}

export function useCategoriesQuery() {
  const { data, error, mutate } = useSWR("categories", fetchCategories, {
    revalidateOnFocus: false,
  });

  return {
    categories: data || [],
    mutateCategories: mutate,
  };
}
