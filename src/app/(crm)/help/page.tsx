/** /help — マニュアルの目次へ（REQ-0056） */
import { redirect } from 'next/navigation'

export default function HelpIndexRedirect() {
  redirect('/help/index')
}
