export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isValidPassword(password) {
  return password.length >= 8
}

export function onlyDigits(value = '') {
  return String(value).replace(/\D/g, '')
}

export function formatCpf(value = '') {
  return onlyDigits(value).slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function isValidCpf(value = '') {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digit = length => {
    let sum = 0
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index)
    const result = (sum * 10) % 11
    return result === 10 ? 0 : result
  }
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10])
}

export function formatPhone(value = '') {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 10) return digits.replace(/^(\d{0,2})(\d{0,4})(\d{0,4})/, (_, ddd, first, last) => [ddd && `(${ddd}`, ddd?.length === 2 ? ') ' : '', first, last && `-${last}`].join(''))
  return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
}

export function validateAuthForm(mode, values) {
  const errors = {}
  if (mode === 'register' && !values.name.trim()) errors.name = 'Como podemos chamar você?'
  if (mode === 'register') {
    if (!values.cpf?.trim()) errors.cpf = 'Informe seu CPF.'
    else if (!isValidCpf(values.cpf)) errors.cpf = 'Confira os números do CPF.'
  }
  if (!values.email.trim()) errors.email = 'Informe seu e-mail.'
  else if (!isValidEmail(values.email)) errors.email = 'Confira o e-mail. Exemplo: voce@email.com'
  if (mode !== 'recover') {
    if (!values.password) errors.password = 'Informe sua senha.'
    else if (mode === 'register' && !isValidPassword(values.password)) errors.password = 'Use pelo menos 8 caracteres.'
  }
  if (mode === 'register') {
    if (!values.confirmPassword) errors.confirmPassword = 'Digite sua senha novamente.'
    else if (values.confirmPassword !== values.password) errors.confirmPassword = 'As senhas precisam ser iguais.'
  }
  return errors
}

export function validateLoginForm(values) {
  return validateAuthForm('login', values)
}
