import type { RecipeDraft } from "@/lib/domain/recipe";

export type ImportStage = "home" | "parsing" | "imageReview" | "recipeConfirm" | "saving";

export type ImportFlowState = {
  stage: ImportStage;
  rawInput: string;
  parsingStep: 0 | 1 | 2 | 3;
  draft: RecipeDraft | null;
  reviewUrls: string[];
  selectedUrls: string[];
  coverUrl: string | null;
  error: string | null;
  dirty: boolean;
};

export type ImportFlowEvent =
  | { type: "INPUT_CHANGED"; rawInput: string }
  | { type: "PARSE_STARTED" }
  | { type: "PARSE_STEP_CHANGED"; step: 0 | 1 | 2 | 3 }
  | { type: "PARSE_SUCCEEDED"; draft: RecipeDraft; imageUrls: string[]; selectedUrls: string[] }
  | { type: "PARSE_FAILED"; message: string }
  | { type: "PARSE_CANCELLED" }
  | { type: "REVIEW_BACK" }
  | { type: "IMAGE_TOGGLED"; url: string }
  | { type: "COVER_SELECTED"; url: string | null }
  | { type: "CONFIRM_OPENED"; withoutImages?: boolean }
  | { type: "DRAFT_CHANGED"; draft: RecipeDraft }
  | { type: "SAVE_STARTED" }
  | { type: "SAVE_FAILED"; message: string }
  | { type: "DRAFT_RESTORED"; state: ImportFlowState }
  | { type: "RESET" };

export const initialImportFlowState: ImportFlowState = {
  stage: "home",
  rawInput: "",
  parsingStep: 0,
  draft: null,
  reviewUrls: [],
  selectedUrls: [],
  coverUrl: null,
  error: null,
  dirty: false
};

function unique(urls: string[]) {
  return [...new Set(urls)];
}

export function importFlowReducer(state: ImportFlowState, event: ImportFlowEvent): ImportFlowState {
  switch (event.type) {
    case "INPUT_CHANGED": return { ...state, rawInput: event.rawInput, error: null };
    case "PARSE_STARTED": return { ...state, stage: "parsing", parsingStep: 0, error: null };
    case "PARSE_STEP_CHANGED": return state.stage === "parsing" ? { ...state, parsingStep: event.step } : state;
    case "PARSE_SUCCEEDED": {
      const reviewUrls = unique(event.imageUrls);
      const selectedUrls = unique(event.selectedUrls).filter((url) => reviewUrls.includes(url));
      return { ...state, stage: "imageReview", parsingStep: 3, draft: event.draft, reviewUrls, selectedUrls, coverUrl: selectedUrls[0] ?? null, error: null, dirty: false };
    }
    case "PARSE_FAILED": return { ...state, stage: "home", parsingStep: 0, error: event.message };
    case "PARSE_CANCELLED": return { ...state, stage: "home", parsingStep: 0, error: null };
    case "REVIEW_BACK": return { ...state, stage: "home", error: null };
    case "IMAGE_TOGGLED": {
      const selectedUrls = state.selectedUrls.includes(event.url)
        ? state.selectedUrls.filter((url) => url !== event.url)
        : unique([...state.selectedUrls, event.url]);
      return { ...state, selectedUrls, coverUrl: state.coverUrl === event.url && !selectedUrls.includes(event.url) ? null : state.coverUrl };
    }
    case "COVER_SELECTED": {
      if (event.url === null) return { ...state, coverUrl: null };
      return { ...state, selectedUrls: unique([...state.selectedUrls, event.url]), coverUrl: event.url };
    }
    case "CONFIRM_OPENED": return event.withoutImages
      ? { ...state, stage: "recipeConfirm", selectedUrls: [], coverUrl: null, dirty: true, error: null }
      : { ...state, stage: "recipeConfirm", dirty: true, error: null };
    case "DRAFT_CHANGED": return { ...state, draft: event.draft, dirty: true, error: null };
    case "SAVE_STARTED": return { ...state, stage: "saving", error: null };
    case "SAVE_FAILED": return { ...state, stage: "recipeConfirm", error: event.message, dirty: true };
    case "DRAFT_RESTORED": return event.state;
    case "RESET": return initialImportFlowState;
  }
}
