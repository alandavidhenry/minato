export interface ComprehensionQuestion {
  id: string
  question: string
  options: string[] // choices displayed to the customer
  answer: string // must equal one of the options; stored server-side only, never sent to client
}

export type ComprehensionQuestionSchema = ComprehensionQuestion[]

// Sent to the client — answer is omitted, options are included so the customer can see the choices
export interface ComprehensionQuestionForClient {
  id: string
  question: string
  options: string[]
}
