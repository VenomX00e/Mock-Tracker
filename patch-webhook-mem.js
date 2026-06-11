import fs from 'fs';

let apiRouter = fs.readFileSync('api-router.ts', 'utf-8');

const memLogs = `
// In-memory array to store webhook logs (since backend lacks Firebase credentials to write directly)
const IN_MEMORY_WEBHOOK_LOGS: any[] = [];

app.get("/api/cloudinary/webhook-logs", (req, res) => {
  res.json({ logs: IN_MEMORY_WEBHOOK_LOGS });
});
`;

// Insert after const app = express();
apiRouter = apiRouter.replace('const app = express();', 'const app = express();\n' + memLogs);

// Replace writeWebhookLog implementation with in-memory push
apiRouter = apiRouter.replace(/const writeWebhookLog = async \([\s\S]*?\} catch \(err\) \{\}\n\};/m, `const writeWebhookLog = async (data: any) => {
  if (!data.timestamp) data.timestamp = new Date().toISOString();
  
  const logEntry = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    ...data
  };
  
  IN_MEMORY_WEBHOOK_LOGS.unshift(logEntry);
  if (IN_MEMORY_WEBHOOK_LOGS.length > 50) {
    IN_MEMORY_WEBHOOK_LOGS.pop();
  }
};`);

fs.writeFileSync('api-router.ts', apiRouter);
console.log('patched api-router.ts');

let useHook = fs.readFileSync('src/hooks/useWebhookLogs.ts', 'utf-8');
useHook = useHook.replace(
  /const fetchLogs = async \(\) => \{[\s\S]*?\} finally \{/m,
  `const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cloudinary/webhook-logs');
      const data = await res.json();
      if (data && data.logs) {
        setLogs(data.logs);
      }
    } catch (err: any) {
      console.error('Error fetching webhook logs:', err);
      setError(err.message || 'Failed to fetch logs');
    } finally {`
);
fs.writeFileSync('src/hooks/useWebhookLogs.ts', useHook);
console.log('patched hook');
