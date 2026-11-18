// ConfigModule validates the environment when AppModule is imported, so these
// placeholders must exist before any test file loads. No network calls are made
// by the e2e suite: it only exercises zero-token paths and validation.
process.env.OPENAI_API_KEY ??= 'sk-test-placeholder';
process.env.PINECONE_API_KEY ??= 'pcsk-test-placeholder';
process.env.PINECONE_INDEX_NAME ??= 'documind-test';