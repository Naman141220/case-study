class Node { 
    // data is the value with which the sorted insert and
    // merge sorts will work
    // obj is whatever object we need inside the node
    constructor( obj=null,data = null,next = null) {
        this.obj = obj
        this.data = data;
        this.next = next;
    }
}

class LinkedList {
    constructor() {
        this.head = null;
    }

    printToEnd(head) {
        let curr = head;
        while (curr != null) {
            console.log(JSON.stringify(curr.obj,null,2));
            // console.log(curr.data)
            curr = curr.next;
        }
    }

    insertAtBegin(obj,val=null) {
        const new_node = new Node(obj,val=null);
        if (this.head === null) {
            this.head = new_node;
            return this.head;
        }
        new_node.next = this.head;
        this.head = new_node;
        return this.head;
    }

    sorted_insert(obj,val=null) {
        const new_node = new Node(obj,val=null);
        if (this.head === null) {
            this.head = new_node;
            return this.head;
        }
        // Insert in sorted order
        if (new_node.data < this.head.data) {
            new_node.next = this.head;
            this.head = new_node;
            return this.head;
        }

        let curr = this.head;
        while (curr.next !== null && curr.next.data < new_node.data) {
            curr = curr.next;
        }
        new_node.next = curr.next;
        curr.next = new_node;
        return this.head;
    }

    insertAtEnd(obj,val=null) {
        const new_node = new Node(obj,val=null);
        if (this.head === null) {
            this.head = new_node;
            return this.head;
        }
        let curr = this.head;
        while (curr.next !== null) {
            curr = curr.next;
        }
        curr.next = new_node;
        return this.head;
    }

    deleteAtHead() {
        if (this.head !== null) {
            this.head = this.head.next;
        }
        return this.head;
    }

    deleteEnd() {
        if (this.head === null) {
            return null;
        }

        let curr = this.head;
        if (curr.next === null) {
            this.head = null;
            return this.head;
        }

        while (curr.next.next !== null) {
            curr = curr.next;
        }
        curr.next = null;
        return this.head;
    }

    divideList(head, div) {
        let curr = head;
        while (curr !== null && div > 1) {
            curr = curr.next;
            div -= 1;
        }
        let temp = curr;
        if (curr) {
            curr = curr.next;
            temp.next = null;
        }
        return [head, curr]; // Return the current node after division
    }

    sizeofLL(head) {
        if (head === null) {
            return 0;
        }
        if (head.next === null) {
            return 1;
        }

        let curr = head;
        let size = 0;
        while (curr) {
            curr = curr.next;
            size += 1;
        }
        return size;
    }

    mergeSort(head) {
        if (this.sizeofLL(head) <= 1) {
            return head;
        }
        let left_list = head;
        let right_list = head;
        let mid = Math.floor(this.sizeofLL(head) / 2);
        [left_list, right_list] = this.divideList(head, mid);
        left_list = this.mergeSort(left_list);
        right_list = this.mergeSort(right_list);

        return this.mergeLL(left_list, right_list);
    }

    mergeLL(head1, head2) {
        let mergeListHead = new Node();
        let resHead = mergeListHead;

        while (head1 && head2) {
            if (head1.data < head2.data) {
                mergeListHead.next = head1;
                head1 = head1.next;
            } else {
                mergeListHead.next = head2;
                head2 = head2.next;
            }
            mergeListHead = mergeListHead.next;
        }

        if (head1 === null) {
            mergeListHead.next = head2;
        } else if (head2 === null) {
            mergeListHead.next = head1;
        }

        return resHead.next;
    }
}

export {LinkedList,Node}

// let LL = new LinkedList();
// LL.insertAtBegin(232);
// LL.insertAtBegin(21314);
// LL.insertAtBegin(2413215);
// LL.insertAtBegin(226);
// LL.sorted_insert(1)
// LL.insertAtBegin(238);

// let sorted_head = LL.mergeSort(LL.head);
// LL.sorted_insert(99821908)
// LL.printToEnd(sorted_head);
