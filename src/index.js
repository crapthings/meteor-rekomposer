import React from 'react'
import recompact from 'recompact'

import isEqual from 'lodash.isequal'
import omit from 'lodash.omit'

const {
  compose,
  withState,
  lifecycle,
  branch,
  renderComponent,
} = recompact

const WITH_STATE_PROPS = ['_withTrackerState', '_setWithTrackerState']

const loadingHandler = () => <div>loading</div>
const errorHandler = () => <div>error</div>

let _defaults = {
  loadingHandler,
  errorHandler,
  pure: false,
  env: {},
  autoUnsub: true,
}

recompact.setDefaults = defaults => Object.assign({}, _defaults, defaults)

const autoUnsub = (handler, subscriptions) => {
  for (const subscriptionId in subscriptions) {
    const subscription = subscriptions[subscriptionId]
    const { readyDeps: { _dependentsById } } = subscription
    if (!_dependentsById[handler._id]) continue
    subscription.readyDeps._dependentsById[handler._id].stop()
  }
}

//

const initialState = withState(WITH_STATE_PROPS[0], WITH_STATE_PROPS[1], false)

const trackReactiveSource = (tracker, options) => lifecycle({
  componentWillReceiveProps(nextProps) {
    if (isEqual(omit(this.props, WITH_STATE_PROPS), omit(nextProps, WITH_STATE_PROPS))) return
    this.handler = Tracker.nonreactive(() => Tracker.autorun(() => {
      this.trackerHandler = tracker(nextProps, this._onData, { ..._defaults.env })
    }))  
  },

  shouldComponentUpdate(nextProps, nextState) {
    if (options.shouldUpdate)
      return options.shouldUpdate(this.props, nextProps, this.state, nextState)

    if (options.pure || !_defaults.pure)
      return true

    return !isEqual(this.props, nextProps) || !isEqual(this.state, nextState)
  },

  componentDidMount() {
    Meteor.defer(() => {
      this._onData = (err, nextProps) => err
        ? this.props._setWithTrackerState(err)
        : this.setState(nextProps, () => this.props._setWithTrackerState(true))

      this.handler = Tracker.nonreactive(() => Tracker.autorun(() => {
        this.trackerHandler = tracker(this.props, this._onData, { ..._defaults.env })
      }))
    })
  },

  componentWillUnmount() {
    if (!this.handler) return

    this.handler.stop()

    if (typeof this.trackerHandler === 'function' && this.trackerHandler.name !== '_onData')
      this.trackerHandler()

    if (options.autoUnsub || _defaults.autoUnsub)
      autoUnsub(this.handler, Meteor.connection._subscriptions)
  },
})

const checkState = ({ _withTrackerState: state }) => typeof state === 'boolean' ? !state : true

const StateComponent = options => ({ _withTrackerState: state, ...props }) => {
  if (typeof state === 'boolean')
    return options.loadingHandler && options.loadingHandler(props) || _defaults.loadingHandler()

  return options.errorHandler ? options.errorHandler(state, props) : _defaults.errorHandler()
}

const branchTrackerState = options => branch(checkState, renderComponent(StateComponent(options)))

//

const withTracker = (tracker, options = {}) => compose(
  initialState,
  trackReactiveSource(tracker, options),
  branchTrackerState(options),
)

recompact.composeWithTracker = recompact.withTracker = withTracker

export default { ...recompact }
