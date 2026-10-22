import { consentVersion } from '../legal'
import { locale } from '../i18n'
import { tr } from '../i18n'
import { isPreview } from '../site';
import { sitePath } from '../site';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Check, CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react';
import { api } from '../api';
export default function PartnerForm({ onClose }: {
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{
        id: string;
        mailEnabled: boolean;
    } | null>(null);
    const [previewPassed, setPreviewPassed] = useState(false);
    const [dragging, setDragging] = useState(false);
    useEffect(() => {
        const element = dialog.current;
        const before = document.activeElement as HTMLElement | null;
        element?.showModal();
        const scroll = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = scroll; before?.focus(); };
    }, []);
    function selectFile(selected: File | null) {
        setError('');
        if (selected && (!/\.(pdf|docx)$/i.test(selected.name) || selected.size > 10 * 1024 * 1024)) {
            setError(tr("Выберите файл DOCX или PDF размером до 10 МБ."));
            setFile(null);
            if (fileInput.current)
                fileInput.current.value = '';
            return;
        }
        setFile(selected);
    }
    async function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');
        if (!file) {
            setError(tr("Приложите заполненный опросный лист."));
            return;
        }
        if (isPreview) {
            setPreviewPassed(true);
            return;
        }
        setBusy(true);
        const data = new FormData(e.currentTarget);
        data.set('questionnaire', file);
        if (data.get('consent') !== 'on') {
            setBusy(false);
            setError(tr("Подтвердите согласие на обработку персональных данных."));
            return;
        }
        data.set('consent', 'true');
        data.set('consentVersion', consentVersion);
        data.set('consentLocale', locale);
        try {
            setResult(await api('/api/applications', { method: 'POST', body: data }));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : tr("Не удалось отправить анкету."));
        }
        finally {
            setBusy(false);
        }
    }
    return <dialog ref={dialog} className="partner-dialog" onCancel={onClose} onClick={e => { if (e.target === dialog.current)
        onClose(); }} aria-labelledby="partner-title">
    <div className="dialog-content">
      <button className="icon-button dialog-close" onClick={onClose} aria-label={tr("Закрыть форму")}><X size={22}/></button>
      {result || previewPassed ? <div className="form-success" role="status">
        <div className="success-icon"><CheckCircle2 size={36}/></div>
        <span className="eyebrow">{previewPassed ? tr("ТЕСТОВАЯ ПРОВЕРКА") : tr("ПЕРВЫЙ ШАГ СДЕЛАН")}</span>
        <h2 id="partner-title">{previewPassed ? tr("Форма заполнена корректно.") : <>{tr("Спасибо за интерес")}{' '}<br />{tr("к партнёрству.")}</>}</h2>
        <p>{previewPassed ? tr("Поля заполнены, файл выбран. В тестовой версии данные и файл остаются на вашем устройстве. Заявка не отправлялась.") : <>{tr("Анкета принята и сохранена. ")}{result?.mailEnabled ? tr("Она поставлена в очередь на отправку координатору.") : tr("Координатор сможет рассмотреть её в системе. Отправка на почту станет доступна после подключения почтового сервера.")}</>}</p>
        {result && <div className="application-id">{tr("Номер заявки: ")}<strong>{result.id.slice(0, 8).toUpperCase()}</strong></div>}
        <button className="button button-dark" onClick={onClose}>{tr("Вернуться на сайт ")}<ArrowUpRight size={18}/></button>
      </div> : <>
        <span className="eyebrow red">{tr("СГТ-КСК / ПАРТНЁРСТВО")}</span>
        <h2 id="partner-title">{tr("Большие задачи.")}{' '}<br />{tr("Надёжные партнёры.")}</h2>
        <p className="dialog-intro">{tr("Расскажите о вашей компании. Мы изучим компетенции и обсудим возможности совместной работы.")}</p>
        <a className="download-strip" href={sitePath('/documents/sgt-partner-questionnaire.docx')} download><FileText size={23}/><span><strong>{tr("Сначала заполните опросный лист")}</strong><small>{tr("DOCX \u00B7 на русском языке")}</small></span><ArrowDownToLine size={20}/></a>
        {isPreview && <p className="preview-inline-note">{tr("Тестовый просмотр: данные и файл не отправляются.")}</p>}<form onSubmit={submit}>
          <div className="form-grid">
            <label>{tr("Компания ")}<span>*</span><input name="company" autoComplete="organization" required minLength={2} maxLength={200} placeholder={tr("ООО \u00ABНазвание компании\u00BB")}/></label>
            <label>{tr("ИНН")}<input name="inn" inputMode="numeric" pattern="([0-9]{10}|[0-9]{12})" maxLength={12} placeholder={tr("10 или 12 цифр")}/></label>
            <label>{tr("Контактное лицо ")}<span>*</span><input name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder={tr("Имя и фамилия")}/></label>
            <label>{tr("Электронная почта ")}<span>*</span><input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="name@company.ru"/></label>
          </div>
          <label className="message-field">{tr("Комментарий")}<textarea name="message" maxLength={3000} rows={2} placeholder={tr("Направления работ, регионы или ваш вопрос")}/></label>
          <label className={`upload-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files[0] || null); }}>
            <input ref={fileInput} name="questionnaire" type="file" accept=".docx,.pdf" onChange={e => selectFile(e.target.files?.[0] || null)}/>
            {file ? <Check size={25}/> : <Upload size={25}/>}
            <strong>{file ? file.name : tr("Загрузите заполненную анкету")}</strong>
            <small>{file ? `${(file.size / 1024).toFixed(0)} ${tr('КБ · нажмите, чтобы заменить')}` : tr("Перетащите файл или выберите на устройстве \u00B7 DOCX, PDF до 10 МБ")}</small>
          </label>
          <div className="honeypot" aria-hidden="true"><label>{tr("Ваш сайт")}<input name="website" tabIndex={-1} autoComplete="off" defaultValue=""/></label></div>
          <label className="checkbox-label"><input type="checkbox" name="consent" required/><span>{tr("Даю ")}<a href={sitePath('/consent')} target="_blank" rel="noreferrer">{tr("отдельное согласие на обработку моих персональных данных")}</a>{tr(" АО \u00ABСГТХОЛДИНГ\u00BB для рассмотрения партнёрства и связи со мной.")}</span></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-red full-width" type="submit" disabled={busy}>{busy ? <><Loader2 className="spin" size={18}/>{tr(" Сохраняем анкету\u2026")}</> : <>{isPreview ? tr("Проверить форму") : tr("Отправить заявку")} <ArrowUpRight size={19}/></>}</button>
          <p className="data-notice">{tr("Порядок обработки, сроки хранения и отзыв согласия: ")}<a href={sitePath('/privacy')} target="_blank" rel="noreferrer">{tr("политика обработки персональных данных")}</a>{tr(". Не прикладывайте паспортные данные и сведения других лиц без законного основания.")}</p><p className="form-note">{tr("Анкета не создаёт обязательств по вступлению в консорциум.")}</p>
        </form>
      </>}
    </div>
  </dialog>;
}
