function normalized(value: string | undefined) {
  return String(value ?? '').trim().toLowerCase();
}

export function getRuntimeEnvironment() {
  return normalized(process.env.MOODLELIKE_ENV)
    || normalized(process.env.CSC_ENV)
    || normalized(process.env.NODE_ENV);
}

export function isProductionRuntime() {
  return [process.env.MOODLELIKE_ENV, process.env.CSC_ENV, process.env.NODE_ENV]
    .some((value) => normalized(value) === 'production');
}
