-- Migration 045: Update Qwen provider base_url to MaaS endpoint
-- The default DashScope URL was replaced with the user's custom MaaS endpoint.

UPDATE ai_providers
SET base_url = 'https://ws-rh78sq9e8exoovge.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'
WHERE id = 'qwen';
