-- Migration 038: Seed OpenAI-compatible providers and models
-- Adds Qwen and DeepSeek as available providers with their models.
-- These are seeded as disabled by default — user enables from Settings.

-- ============================================
-- PROVIDERS
-- ============================================

INSERT INTO ai_providers (id, name, slug, description, api_key_env_var, base_url, capabilities, config, enabled)
VALUES
  ('qwen', 'Alibaba Qwen', 'qwen', 'Qwen via DashScope (OpenAI-compatible)', 'QWEN_API_KEY', 'https://dashscope.aliyuncs.com/compatible-mode/v1', '{"chat", "vision", "tool-use"}', '{"defaultModel":"qwen-plus"}', false),
  ('deepseek', 'DeepSeek', 'deepseek', 'DeepSeek AI (OpenAI-compatible)', 'DEEPSEEK_API_KEY', 'https://api.deepseek.com/v1', '{"chat", "tool-use"}', '{"defaultModel":"deepseek-chat"}', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- MODELS
-- ============================================

-- Qwen models
INSERT INTO ai_models (id, provider_id, name, model_id, enabled, context_window, input_price, output_price, capabilities)
VALUES
  ('qwen-turbo', 'qwen', 'Qwen Turbo', 'qwen-turbo', false, 100000, 0.002, 0.006, '{"chat"}'),
  ('qwen-plus', 'qwen', 'Qwen Plus', 'qwen-plus', false, 131072, 0.004, 0.012, '{"chat", "vision", "tool-use"}'),
  ('qwen-max', 'qwen', 'Qwen Max', 'qwen-max', false, 32768, 0.024, 0.048, '{"chat", "vision", "tool-use"}'),
  ('qwen-vl-plus', 'qwen', 'Qwen VL Plus', 'qwen-vl-plus', false, 131072, 0.008, 0.016, '{"chat", "vision"}')
ON CONFLICT (id) DO NOTHING;

-- DeepSeek models
INSERT INTO ai_models (id, provider_id, name, model_id, enabled, context_window, input_price, output_price, capabilities)
VALUES
  ('deepseek-chat', 'deepseek', 'DeepSeek Chat', 'deepseek-chat', false, 65536, 0.0014, 0.0028, '{"chat", "tool-use"}'),
  ('deepseek-reasoner', 'deepseek', 'DeepSeek Reasoner', 'deepseek-reasoner', false, 65536, 0.0055, 0.0219, '{"chat", "tool-use"}')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- AGENT MODEL ROUTES (default routes for existing agents)
-- ============================================

-- Default routes: each agent gets qwen-plus as a secondary option
-- Only if no routes exist for the agent yet
INSERT INTO agent_model_routes (agent_id, model_id, priority, policy, enabled)
SELECT 'product-hunter', 'qwen-plus', 10, 'priority', false
WHERE NOT EXISTS (SELECT 1 FROM agent_model_routes WHERE agent_id = 'product-hunter');

INSERT INTO agent_model_routes (agent_id, model_id, priority, policy, enabled)
SELECT 'market-research', 'qwen-plus', 10, 'priority', false
WHERE NOT EXISTS (SELECT 1 FROM agent_model_routes WHERE agent_id = 'market-research');

INSERT INTO agent_model_routes (agent_id, model_id, priority, policy, enabled)
SELECT 'supplier-research', 'deepseek-chat', 10, 'priority', false
WHERE NOT EXISTS (SELECT 1 FROM agent_model_routes WHERE agent_id = 'supplier-research');

INSERT INTO agent_model_routes (agent_id, model_id, priority, policy, enabled)
SELECT 'marketing', 'qwen-plus', 10, 'priority', false
WHERE NOT EXISTS (SELECT 1 FROM agent_model_routes WHERE agent_id = 'marketing');

INSERT INTO agent_model_routes (agent_id, model_id, priority, policy, enabled)
SELECT 'ceo', 'deepseek-chat', 10, 'priority', false
WHERE NOT EXISTS (SELECT 1 FROM agent_model_routes WHERE agent_id = 'ceo');
