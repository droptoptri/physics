import { isPreview } from '../site'
import { sitePath } from '../site'
import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpRight, Check, CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react'
import { api } from '../api'

export default function PartnerForm({ onClose }: { onClose: () => void }) {
  const dialog=useRef<HTMLDialogElement>(null)
  const fileInput=useRef<HTMLInputElement>(null)
  const [file,setFile]=useState<File|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [result,setResult]=useState<{id:string;mailEnabled:boolean}|null>(null)
  const [previewPassed,setPreviewPassed]=useState(false)
  const [dragging,setDragging]=useState(false)
  useEffect(()=>{
    const element=dialog.current
    const before=document.activeElement as HTMLElement|null
    element?.showModal()
    const scroll=document.body.style.overflow
    document.body.style.overflow='hidden'
    return ()=>{document.body.style.overflow=scroll;before?.focus()}
  },[])
  function selectFile(selected: File|null) {
    setError('')
    if(selected && (!/\.(pdf|docx)$/i.test(selected.name) || selected.size>10*1024*1024)){
      setError('Выберите файл DOCX или PDF размером до 10 МБ.');setFile(null);if(fileInput.current)fileInput.current.value='';return
    }
    setFile(selected)
  }
  async function submit(e:React.FormEvent<HTMLFormElement>) {
    e.preventDefault();setError('')
    if(!file){setError('Приложите заполненный опросный лист.');return}
    if(isPreview){setPreviewPassed(true);return}
    setBusy(true)
    const data=new FormData(e.currentTarget)
    data.set('questionnaire',file)
    data.set('consent','true')
    try{setResult(await api('/api/applications',{method:'POST',body:data}))}
    catch(e){setError(e instanceof Error?e.message:'Не удалось отправить анкету.')}
    finally{setBusy(false)}
  }
  return <dialog ref={dialog} className="partner-dialog" onCancel={onClose} onClick={e=>{if(e.target===dialog.current)onClose()}} aria-labelledby="partner-title">
    <div className="dialog-content">
      <button className="icon-button dialog-close" onClick={onClose} aria-label="Закрыть форму"><X size={22}/></button>
      {result||previewPassed?<div className="form-success" role="status">
        <div className="success-icon"><CheckCircle2 size={36}/></div>
        <span className="eyebrow">{previewPassed?'ТЕСТОВАЯ ПРОВЕРКА':'ПЕРВЫЙ ШАГ СДЕЛАН'}</span>
        <h2 id="partner-title">{previewPassed?'Форма заполнена корректно.':<>Спасибо за интерес{' '}<br/>к партнёрству.</>}</h2>
        <p>{previewPassed?'Поля заполнены, файл выбран. В тестовой версии данные и файл остаются на вашем устройстве. Заявка не отправлялась.':<>Анкета принята и сохранена. {result?.mailEnabled?'Она поставлена в очередь на отправку координатору.':'Координатор сможет рассмотреть её в системе. Отправка на почту станет доступна после подключения почтового сервера.'}</>}</p>
        {result&&<div className="application-id">Номер заявки: <strong>{result.id.slice(0,8).toUpperCase()}</strong></div>}
        <button className="button button-dark" onClick={onClose}>Вернуться на сайт <ArrowUpRight size={18}/></button>
      </div>:<>
        <span className="eyebrow red">СГТ-КСК / ПАРТНЁРСТВО</span>
        <h2 id="partner-title">Большие задачи.{' '}<br/>Надёжные партнёры.</h2>
        <p className="dialog-intro">Расскажите о вашей компании. Мы изучим компетенции и обсудим возможности совместной работы.</p>
        <a className="download-strip" href={sitePath('/documents/sgt-partner-questionnaire.docx')} download><FileText size={23}/><span><strong>Сначала заполните опросный лист</strong><small>DOCX · 50 КБ</small></span><ArrowDownToLine size={20}/></a>
        {isPreview&&<p className="preview-inline-note">Тестовый просмотр: данные и файл не отправляются.</p>}<form onSubmit={submit}>
          <div className="form-grid">
            <label>Компания <span>*</span><input name="company" autoComplete="organization" required minLength={2} maxLength={200} placeholder="ООО «Название компании»"/></label>
            <label>ИНН<input name="inn" inputMode="numeric" pattern="([0-9]{10}|[0-9]{12})" maxLength={12} placeholder="10 или 12 цифр"/></label>
            <label>Контактное лицо <span>*</span><input name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Имя и фамилия"/></label>
            <label>Электронная почта <span>*</span><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="name@company.ru"/></label>
          </div>
          <label className="message-field">Комментарий<textarea name="message" maxLength={3000} rows={2} placeholder="Направления работ, регионы или ваш вопрос"/></label>
          <label className={`upload-zone ${dragging?'dragging':''} ${file?'has-file':''}`} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);selectFile(e.dataTransfer.files[0]||null)}}>
            <input ref={fileInput} name="questionnaire" type="file" accept=".docx,.pdf" onChange={e=>selectFile(e.target.files?.[0]||null)}/>
            {file?<Check size={25}/>:<Upload size={25}/>}
            <strong>{file?file.name:'Загрузите заполненную анкету'}</strong>
            <small>{file?`${(file.size/1024).toFixed(0)} КБ · нажмите, чтобы заменить`:'Перетащите файл или выберите на устройстве · DOCX, PDF до 10 МБ'}</small>
          </label>
          <div className="honeypot" aria-hidden="true"><label>Ваш сайт<input name="website" tabIndex={-1} autoComplete="off" defaultValue=""/></label></div>
          <label className="checkbox-label"><input type="checkbox" name="consent" required/><span>Даю согласие на обработку данных из формы и приложенной анкеты для рассмотрения партнёрства. Ознакомлен с <a href={sitePath('/privacy')} target="_blank" rel="noreferrer">политикой обработки данных</a>.</span></label>
          {error&&<p className="form-error" role="alert">{error}</p>}
          <button className="button button-red full-width" type="submit" disabled={busy}>{busy?<><Loader2 className="spin" size={18}/> Сохраняем анкету…</>:<>{isPreview?'Проверить форму':'Отправить заявку'} <ArrowUpRight size={19}/></>}</button>
          <p className="form-note">Анкета не создаёт обязательств по вступлению в консорциум.</p>
        </form>
      </>}
    </div>
  </dialog>
}
