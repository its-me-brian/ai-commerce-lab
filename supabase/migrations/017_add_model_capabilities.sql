-- Migration 017: Add capabilities to ai_models
-- FASE 7: Model Registry — capability-aware model management
-- Capabilities: vision, json-mode, tool-use, code-generation, reasoning, multimodal, streaming

ALTER TABLE ai_models
ADD COLUMN IF NOT EXISTS capabilities TEXT[] DEFAULT '{}';

-- Update existing models with their capabilities
UPDATE ai_models SET capabilities = ARRAY['vision', 'json-mode', 'tool-use', 'code-generation', 'reasoning'] WHERE model_id = 'gemini-3-flash-preview';
UPDATE ai_models SET capabilities = ARRAY['vision', 'json-mode', 'tool-use', 'code-generation'] WHERE model_id = 'claude-3-5-haiku-20241022';
UPDATE ai_models SET capabilities = ARRAY['vision', 'json-mode', 'tool-use', 'code-generation', 'reasoning'] WHERE model_id = 'claude-sonnet-4-20250514';
UPDATE ai_models SET capabilities = ARRAY['json-mode', 'tool-use'] WHERE model_id = 'grok-3-mini-latest';

-- Index for capability queries
CREATE INDEX IF NOT EXISTS idx_ai_models_capabilities ON ai_models USING GIN (capabilities);
