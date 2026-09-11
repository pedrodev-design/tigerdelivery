export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isValidPassword(password) {
  return password.length >= 8
}

export function validateAuthForm(mode, values) {
  const errors = {}
  if (mode === 'register' && !values.name.trim()) errors.name = 'Como podemos chamar você?'
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
