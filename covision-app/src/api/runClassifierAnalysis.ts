import { loadGraphModel } from "@tensorflow/tfjs-converter";
import { TestArea } from "./getValidTestArea";
import * as tf from "@tensorflow/tfjs";
import warmUp from "./warmUp";

const MODEL_URL = "assets/classifier_model/model.json";
const modelPromise = loadGraphModel(MODEL_URL);
warmUp(modelPromise);

export enum TestResult {
  Pending = -3,
  NotFound = -2,
  Unknown = -1,
  Positive = 0,
  Negative = 1,
  Empty = 2,
  Invalid = 3,
}

function normalize(img: tf.Tensor4D, mean: number[], std: number[], axis: number) {
  return img
    .sub(tf.reshape(mean, [mean.length, 1, 1]))
    .div(tf.reshape(std, [std.length, 1, 1]));
}

const runClassifierAnalysis = async (testArea: TestArea): Promise<TestResult> => {
  if (!testArea.input_tf || !testArea.area) return TestResult.NotFound;
  const model = await modelPromise;

  const input_tf = tf.tidy(() => {
    if (!testArea.input_tf || !testArea.area) throw new Error('testArea changed unexpectedly');

    const [width, height] = model.inputs[0].shape?.slice(2, 4) ?? [];
    const inputUnnormalized = tf.image.cropAndResize(
      testArea.input_tf,
      [[
        testArea.area.top,
        testArea.area.left,
        testArea.area.bottom,
        testArea.area.right,
      ]],
      [0],
      [height, width],
    ).transpose<tf.Tensor4D>([0, 3, 1, 2]);

    return normalize(inputUnnormalized, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225], 1);
  })

  const result_tf =
    (await model.executeAsync(input_tf)) as tf.Tensor1D;

  const argMax_tf = result_tf.argMax(1);
  const output = Array.from(argMax_tf.dataSync())[0];

  input_tf.dispose();
  result_tf.dispose();
  argMax_tf.dispose();

  return output;
}

export default runClassifierAnalysis;