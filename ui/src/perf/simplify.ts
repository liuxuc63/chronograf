import {Timeseries} from 'src/perf/types'

type Scale = (n: number) => number

export const simplify = (
  times: Float64Array,
  values: Float32Array,
  epsilon: number,
  xScale: Scale,
  yScale: Scale
): Timeseries => {
  // First do one pass with a fast, low quality simplification algorithm
  const xs = times.map(xScale)
  const ys = values.map(yScale)
  const indicesToKeep = simplifyDist(xs, ys, epsilon)
  const [newTimes, newValues] = collect(times, values, indicesToKeep)

  // Then do another pass with a slower, high quality simplification algorithm
  const nextXs = newTimes.map(xScale)
  const nextYs = newValues.map(yScale)
  const nextIndicesToKeep = simplifyDouglasPeucker(nextXs, nextYs, epsilon)

  return collect(times, values, nextIndicesToKeep)
}

const simplifyDouglasPeucker = (
  times: Float64Array,
  values: Float32Array,
  epsilon: number
) => {
  const keep = new Uint8Array(times.length)
  const sqEpsilon = epsilon * epsilon

  keep[0] = 1
  keep[keep.length - 1] = 1

  simplifyDouglasPeuckerHelper(
    times,
    values,
    sqEpsilon,
    0,
    keep.length - 1,
    keep
  )

  return keep
}

const simplifyDouglasPeuckerHelper = (
  times: Float64Array,
  values: Float32Array,
  epsilonSq: number,
  i0: number,
  i1: number,
  keep: Uint8Array
) => {
  const x0 = times[i0]
  const y0 = values[i0]
  const x1 = times[i1]
  const y1 = values[i1]

  let maxIndex = 0
  let maxDist = -1

  for (let i = i0 + 1; i < i1; i++) {
    const sqDist = sqSegmentDist(x0, y0, x1, y1, times[i], values[i])

    if (sqDist > maxDist) {
      maxIndex = i
      maxDist = sqDist
    }
  }

  if (maxDist > epsilonSq) {
    keep[maxIndex] = 1

    if (maxIndex - i0 > 1) {
      simplifyDouglasPeuckerHelper(times, values, epsilonSq, i0, maxIndex, keep)
    }

    if (i1 - maxIndex > 1) {
      simplifyDouglasPeuckerHelper(times, values, epsilonSq, maxIndex, i1, keep)
    }
  }
}

// Shortest distance from (x2, y2) to the line segment between (x0, y0) and (x1, y1)
const sqSegmentDist = (x0, y0, x1, y1, x2, y2) => {
  let x = x0
  let y = y0
  let dx = x1 - x0
  let dy = y1 - y0

  if (dx !== 0 || dy !== 0) {
    const t = ((x2 - x) * dx + (y2 - y) * dy) / (dx * dx + dy * dy)

    if (t > 1) {
      x = x1
      y = y1
    } else if (t > 0) {
      x += dx * t
      y += dy * t
    }
  }

  dx = x2 - x
  dy = y2 - y

  return dx * dx + dy * dy
}

const simplifyDist = (
  times: Float64Array,
  values: Float32Array,
  epsilon: number
) => {
  const epsilonSq = epsilon ** 2
  const keep = new Uint8Array(times.length)

  let prevX = times[0]
  let prevY = values[0]

  keep[0] = 1
  keep[keep.length - 1] = 1

  for (let i = 1; i < times.length; i++) {
    const x = times[i]
    const y = values[i]
    const sqDist = (prevY - y) ** 2 + (prevX - x) ** 2

    if (sqDist > epsilonSq) {
      keep[i] = 1
      prevX = x
      prevY = y
    }
  }

  return keep
}

const collect = (
  originalTimes: Float64Array,
  originalValues: Float32Array,
  indicesToKeep: Uint8Array
): Timeseries => {
  let resultLength = 0

  for (let j = 0; j < indicesToKeep.length; j++) {
    if (indicesToKeep[j] === 1) {
      resultLength++
    }
  }

  const times = new Float64Array(resultLength)
  const values = new Float32Array(resultLength)

  let i = 0

  for (let j = 0; j < indicesToKeep.length; j++) {
    if (indicesToKeep[j] === 1) {
      times[i] = originalTimes[j]
      values[i] = originalValues[j]
      i++
    }
  }

  return [times, values]
}
