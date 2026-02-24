export default async function handler(req: any, res: any) {
  // Na Vercel, a memória não é persistente entre requisições.
  // Retornamos um aviso para o usuário olhar os logs nativos da Vercel.
  res.status(200).json([{
    id: Date.now(),
    time: new Date().toISOString(),
    type: 'info',
    message: 'Você está rodando na Vercel. Para ver os logs completos de erro do Webhook, acesse a aba "Logs" no painel do seu projeto na Vercel.',
    details: null
  }]);
}
