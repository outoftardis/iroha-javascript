import {
    Event,
    EventFilter,
    EventSubscriberMessage,
    Enum,
    VersionedEventPublisherMessageCodec,
    VersionedEventSubscriberMessageCodec,
} from '@iroha2/data-model';
import Emittery from 'emittery';
import Debug from 'debug';
import { setupWebSocket, SocketEmitMapBase } from './util';
import { ENDPOINT_EVENTS } from './const';

const debug = Debug('@iroha2/client:events');

export interface EventsEmitteryMap extends SocketEmitMapBase {
    event: Event;
}

export interface SetupEventsParams {
    toriiApiURL: string;
    filter: EventFilter;
}

export interface SetupEventsReturn {
    stop: () => void;
    isClosed: () => boolean;
    ee: Emittery<EventsEmitteryMap>;
}

/**
 * Promise resolved when connection handshake is acquired
 */
export async function setupEvents(params: SetupEventsParams): Promise<SetupEventsReturn> {
    const {
        ee,
        isClosed,
        close,
        accepted,
        send: sendRaw,
    } = setupWebSocket<EventsEmitteryMap>({
        baseURL: params.toriiApiURL,
        endpoint: ENDPOINT_EVENTS,
        parentDebugger: debug,
    });

    function send(msg: EventSubscriberMessage) {
        sendRaw(VersionedEventSubscriberMessageCodec.toBuffer(Enum.variant('V1', msg)));
    }

    ee.on('open', () => {
        send(Enum.variant('SubscriptionRequest', params.filter));
    });

    ee.on('message', (raw) => {
        const event = VersionedEventPublisherMessageCodec.fromBuffer(raw).as('V1');

        if (event.is('SubscriptionAccepted')) {
            debug('subscription accepted');
            ee.emit('accepted');
        } else {
            ee.emit('event', event.as('Event'));
            send(Enum.variant('EventReceived'));
        }
    });

    await accepted();

    return {
        stop: close,
        ee:
            // Emittery typing bug :<
            ee as any,
        isClosed,
    };
}
