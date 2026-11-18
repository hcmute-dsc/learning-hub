# checker-example

A tiny stand-in for the **private** `learning-hub-checker` repo (CONTENT-SPECIFICATION §3.8),
used for local development and tests. Reference solutions live here, never in a public
content repo:

```
exercises/<track-slug>/<exercise-slug>/solution.md
```

The API reads it when `SOLUTIONS_SOURCE=local` (`SOLUTIONS_LOCAL_DIR`, default `../../checker-example`).
Members see a solution only after their first attempt on the exercise.
