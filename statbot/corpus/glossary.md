---
title: statLearner glossary
source: Written for statLearner (original text)
url: https://github.com/dfeldmann-bot/statLearner
license: GPL-3.0 (this repository)
---
## Population and sample
The population is the whole group you want to learn about. A sample is the part of it you actually observe. A random sample gives every member a known chance of selection, which lets you generalise from the sample to the population.

## Parameter and statistic
A parameter is a number that describes a population, such as the population mean μ or proportion p. A statistic is a number computed from a sample, such as the sample mean x̄ or the sample proportion p̂. Statistics estimate parameters.

## Sampling bias
Sampling bias occurs when the way a sample is collected makes some members of the population more likely to be included than others, for example an online poll answered only by people who care strongly. A larger biased sample does not fix the bias.

## Observational study and experiment
In an observational study the researcher only records what happens. In an experiment the researcher assigns treatments, ideally at random. Random assignment balances confounders on average, so only experiments support cause-and-effect conclusions directly.

## Confounder
A confounder is a variable that influences both the explanatory variable and the response, creating an association that is not causal. Hot weather confounds the association between ice-cream sales and drowning.

## Outlier
An outlier is an observation far from the bulk of the data. Outliers can be errors or the most interesting cases. Check them, report them, and compare results with and without them.

## Variance
The variance is the average squared distance of values from their mean. The sample variance divides the sum of squared deviations by n − 1. Its square root is the standard deviation, which has the same units as the data.

## Quartiles and the five-number summary
Quartiles split sorted data into four parts: the first quartile Q1 has 25% of the values below it, the median 50%, and the third quartile Q3 75%. The five-number summary is minimum, Q1, median, Q3, maximum; a box plot draws it.

## Probability distribution
A probability distribution lists the possible values of a random variable together with their probabilities, which add up to 1. A continuous distribution uses a density curve instead: probabilities are areas under the curve.

## Law of large numbers
The law of large numbers says that the proportion of times an outcome occurs gets closer to its true probability as the number of independent repetitions grows. It does not mean that short-run streaks are corrected.

## Standard normal distribution
The standard normal distribution is the normal distribution with mean 0 and standard deviation 1. Any normal value x becomes a standard normal value through the z-score z = (x − μ)/σ.

## t-distribution
The t-distribution looks like the standard normal but has heavier tails. It is used for means when the population standard deviation is estimated by the sample SD. Its shape depends on the degrees of freedom, n − 1 for a single mean; with many degrees of freedom it is almost normal.

## Degrees of freedom
Degrees of freedom count how many values are free to vary once some quantities are fixed. After computing x̄ from n values, only n − 1 deviations are free, which is why the sample variance divides by n − 1.

## Margin of error
The margin of error is the half-width of a confidence interval: critical value times standard error. It covers random sampling error only, not bias from poor sampling or measurement.

## Statistical significance
A result is statistically significant at level α when its p-value is at most α. Significance says the data would be unusual if the null hypothesis were true; it does not say the effect is large or important.

## Effect size
An effect size measures how big a difference or relationship is, in the data's units or in standardised units. Report it with a confidence interval alongside any p-value.

## Power
The power of a test is the probability that it rejects a false null hypothesis. Power increases with larger samples, larger true effects, less variable data and a larger significance level α.

## Independence of observations
Observations are independent when one gives no information about another. Random sampling and random assignment usually ensure it; repeated measurements on the same person, or clustered data, break it.

## Paired data
Data are paired when each observation in one group is matched with one in the other, such as before-and-after measurements on the same person. Analyse paired data through the differences within each pair, not as two independent groups.

## Residual
A residual is the observed value minus the value predicted by a model: e = y − ŷ. Residuals that show a pattern when plotted against x reveal what the model misses.

## Coefficient of determination
The coefficient of determination R² is the share of the variability in the response that the regression model explains. In simple linear regression it equals the square of the correlation r.
