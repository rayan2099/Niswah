export default function handler(_req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(200).json({ ok: true });
}
