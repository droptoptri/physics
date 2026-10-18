import { isPreview } from './site'
export interface User { id: number; name: string; email: string; company: string; approved: number }
export interface Tender { id: number; title: string; category: string; region: string; description: string; deadline: string; contact: string }
let csrf: Promise<string> | null = null
async function token() {
  if(!csrf)csrf=fetch('/api/csrf',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw new Error('Не удалось установить защищённое соединение.');return r.json()}).then(d=>d.token).catch(e=>{csrf=null;throw e})
  return csrf
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (isPreview) throw new Error('Серверные операции недоступны в тестовой версии GitHub Pages.')
  const method=options.method || 'GET'
  const headers=new Headers(options.headers)
  if(method!=='GET')headers.set('X-CSRF-Token',await token())
  if(options.body && !(options.body instanceof FormData))headers.set('Content-Type','application/json')
  let response: Response
  try {response=await fetch(path,{...options,headers,credentials:'same-origin'})}
  catch {throw new Error('Нет соединения с сервером. Проверьте подключение и повторите попытку.')}
  const result=await response.json()
  if(!response.ok){if(response.status===403)csrf=null;throw new Error(result.error || 'Не удалось выполнить запрос.')}
  return result
}
