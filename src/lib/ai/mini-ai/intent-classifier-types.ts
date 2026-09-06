// Intent Classifier Types
// Shared types for intent classification (server + client)

export type IntentCategory = 
  | "greeting"
  | "product_search" 
  | "memory_lookup"
  | "simple_query"
  | "complex_query"
  | "unknown";
